import { prisma } from '~/prisma/index'

const extractSearchTerm = (name) => {
  const lastDashIndex = name.lastIndexOf(' - ')
  if (lastDashIndex !== -1) {
    return name.substring(0, lastDashIndex).trim()
  }
  return name.trim()
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchVnDetails = async (name) => {
  try {
    const vndbResponse = await fetch('https://api.vndb.org/kana/vn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filters: ['search', '=', name],
        fields: 'id, aliases, released'
      })
    })

    if (!vndbResponse.ok) {
      console.error(`Error: Received ${vndbResponse.status} from VNDB API`)
      return null
    }

    const vndbData = await vndbResponse.json()

    if (vndbData.results.length === 0) {
      console.log('No results found for the given name: ', name)
      return null
    }

    const vn = vndbData.results[0]
    return {
      id: vn.id,
      released: vn.released,
      aliases: vn.aliases
    }
  } catch (error) {
    console.error('Error fetching VN details:', error)
    return null
  }
}

const updatePatchInfo = async () => {
  const patches = await prisma.patch.findMany({
    where: {
      vndb_id: null
    }
  })
  let requestCount = 0

  for (const patch of patches) {
    try {
      const searchTerm = extractSearchTerm(patch.name)
      const res = await fetchVnDetails(searchTerm)

      await sleep(2500)

      if (!res) {
        console.log(`Skipping ${patch.name} due to empty result.`)
        continue
      }

      const { id, released, aliases } = res

      const existingPatch = await prisma.patch.findFirst({
        where: {
          vndb_id: id
        }
      })

      if (existingPatch) {
        console.log(
          `Skipping update for ${patch.name} because vndb_id ${id} already exists.`
        )
        continue
      }

      await prisma.patch.update({
        where: { id: patch.id },
        data: {
          vndb_id: id ?? '',
          released: released ?? '',
          alias: aliases
        }
      })

      console.log(
        `Updated galgame ${patch.name} with vndb_id: ${id}, released: ${released}, aliases: ${aliases}`
      )
    } catch (error) {
      console.error(`Failed to update patch ${patch.name}:`, error)
    }

    requestCount++
    console.log(`Processed ${requestCount} requests.`)
  }
}

updatePatchInfo()
