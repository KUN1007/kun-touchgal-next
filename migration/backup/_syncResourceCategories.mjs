import { prisma } from '~/prisma/index'

const arraysAreEqual = (arr1, arr2) => {
  if (arr1.length !== arr2.length) return false
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false
  }
  return true
}

const syncPatchFields = async () => {
  const patches = await prisma.patch.findMany({
    include: {
      resource: {
        select: {
          type: true,
          language: true,
          platform: true
        }
      }
    }
  })

  for (const patch of patches) {
    let allTypes = new Set()
    let allLanguages = new Set()
    let allPlatforms = new Set()

    patch.resource.forEach((res) => {
      res.type.forEach((t) => allTypes.add(t))
      res.language.forEach((l) => allLanguages.add(l))
      res.platform.forEach((p) => allPlatforms.add(p))
    })

    const updatedType = Array.from(allTypes)
    const updatedLanguage = Array.from(allLanguages)
    const updatedPlatform = Array.from(allPlatforms)

    const isTypeChanged = !arraysAreEqual(updatedType, patch.type)
    const isLanguageChanged = !arraysAreEqual(updatedLanguage, patch.language)
    const isPlatformChanged = !arraysAreEqual(updatedPlatform, patch.platform)

    if (isTypeChanged || isLanguageChanged || isPlatformChanged) {
      await prisma.patch.update({
        where: { id: patch.id },
        data: {
          type: updatedType,
          language: updatedLanguage,
          platform: updatedPlatform
        }
      })
      console.log(`Patch ${patch.id} updated`)
    } else {
      console.log(`Patch ${patch.id} is up-to-date`)
    }
  }
}

syncPatchFields().catch((e) => {
  console.error(e)
  prisma.$disconnect()
})
