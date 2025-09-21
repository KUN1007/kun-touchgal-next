import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// const invalidIds = [4219, 1032, 3480, 258, 2310]

const fixPatchBanner = async () => {
  const patch = await prisma.patch.findMany({
    where: { banner: '' }
  })

  for (const p of patch) {
    await prisma.patch.update({
      where: { id: p.id },
      data: {
        banner: `https://img.touchgalstatic.org/patch/${p.id}/banner/banner.avif`
      }
    })
  }

  // const res = await prisma.patch.findMany({
  //   where: { id: { in: invalidIds } }
  // })

  // console.log(res)

  console.log(`Successfully fixed error galgame banners. Task finished.`)
}

fixPatchBanner()
