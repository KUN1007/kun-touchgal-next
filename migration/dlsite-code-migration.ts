import 'dotenv/config'
import { prisma } from '~/prisma/index'
import {
  fetchDlsiteData,
  ensurePatchCompanyFromDlsite
} from '~/app/api/edit/dlsite'
import { handleBatchPatchTags } from '~/app/api/edit/batchTag'

const DLSITE_LINK_REGEX =
  /::kun-link\{[^}]*href="https:\/\/www\.dlsite\.com\/[^"]*product_id\/([A-Za-z0-9]+)\.html\/?"[^}]*\}/i

const parseDlsiteTags = (raw?: string) => {
  if (!raw) return [] as string[]
  return raw
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

const unique = <T>(arr: T[]) => Array.from(new Set(arr))

async function migrateDlsiteCodes() {
  const patches = await prisma.patch.findMany({
    where: {
      introduction: {
        contains: 'dlsite.com'
      }
    },
    include: {
      alias: true,
      tag: {
        include: {
          tag: true
        }
      }
    }
  })

  console.log(`Found ${patches.length} patches containing dlsite links`)
  let successCount = 0
  let skipped = 0

  const processPatch = async (patch: (typeof patches)[number]) => {
    if (patch.dlsite_code) {
      skipped++
      return
    }

    const match = patch.introduction.match(DLSITE_LINK_REGEX)
    if (!match) {
      skipped++
      return
    }

    const code = match[1]?.toUpperCase()
    if (!code) {
      skipped++
      return
    }

    try {
      const dlsiteData = await fetchDlsiteData(code)
      const aliasNames = new Set(
        patch.alias.map((alias) => alias.name.trim()).filter(Boolean)
      )

      const aliasesToInsert = unique(
        [dlsiteData.title_jp, dlsiteData.title_en]
          .map((title) => title?.trim())
          .filter((title): title is string => !!title && !aliasNames.has(title))
      )

      if (aliasesToInsert.length) {
        await prisma.patch_alias.createMany({
          data: aliasesToInsert.map((name) => ({
            patch_id: patch.id,
            name
          })),
          skipDuplicates: true
        })
      }

      const dlsiteTags = parseDlsiteTags(dlsiteData.tags)
      const existingTags = patch.tag.map((relation) => relation.tag.name)
      const mergedTags = unique([...existingTags, ...dlsiteTags])
      if (mergedTags.length) {
        await handleBatchPatchTags(patch.id, mergedTags, patch.user_id)
      }

      await prisma.patch.update({
        where: { id: patch.id },
        data: {
          dlsite_code: code,
          released:
            patch.released === 'unknown' && dlsiteData.release_date
              ? dlsiteData.release_date
              : patch.released
        }
      })

      await ensurePatchCompanyFromDlsite(patch.id, code, patch.user_id)

      successCount++
      console.log(
        `Updated patch ${patch.unique_id} with DLSite code ${code}, aliases +${aliasesToInsert.length}, tags ${mergedTags.length}`
      )
    } catch (error) {
      console.error(
        `Failed to process patch ${patch.unique_id} with code ${code}:`,
        error
      )
    }
  }

  const concurrency = 10
  let currentIndex = 0

  const worker = async () => {
    while (true) {
      const index = currentIndex++
      if (index >= patches.length) break
      await processPatch(patches[index])
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  console.log(
    `Migration completed. Success: ${successCount}, skipped (no code or already set): ${skipped}`
  )
}

migrateDlsiteCodes()
  .catch((error) => {
    console.error('Migration failed:', error)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
