import { z } from 'zod'
import { prisma } from '~/prisma/index'
import { patchResourceCreateSchema } from '~/validations/patch'
import { uploadFileToS3 } from '~/lib/s3'
import { getKv } from '~/lib/redis'
import { createMessage } from '~/app/api/utils/message'
import type { PatchResource } from '~/types/api/patch'

const uploadPatchResource = async (patchId: number, hash: string) => {
  const filePath = await getKv(hash)
  if (!filePath) {
    return '未找到已上传的文件，请重新上传后再试'
  }
  const fileName = filePath.split('/').pop()

  const s3Key = `patch/${patchId}/resource/${hash}/${fileName}`
  await uploadFileToS3(s3Key, filePath)

  const downloadLink = `${process.env.NEXT_PUBLIC_KUN_VISUAL_NOVEL_S3_STORAGE_URL!}/${s3Key}`
  return { downloadLink }
}

export const createPatchResource = async (
  input: z.infer<typeof patchResourceCreateSchema>,
  uid: number,
  userRole: number
) => {
  const {
    patchId,
    type,
    language,
    platform,
    content,
    storage,
    ...resourceData
  } = input

  const currentPatch = await prisma.patch.findUnique({
    where: { id: patchId },
    select: {
      type: true,
      language: true,
      platform: true,
      unique_id: true,
      name: true
    }
  })

  const resourceCount = await prisma.patch_resource.count({
    where: { user_id: uid }
  })
  const needApproval = resourceCount === 0 && userRole < 3

  let res: string
  if (storage === 's3') {
    const result = await uploadPatchResource(patchId, resourceData.hash)
    if (typeof result === 'string') {
      return result
    }
    res = result.downloadLink
  } else {
    res = content
  }

  const resource = await prisma.$transaction(async (prisma) => {
    const newResource = await prisma.patch_resource.create({
      data: {
        patch_id: patchId,
        user_id: uid,
        type,
        language,
        platform,
        content: res,
        storage,
        status: needApproval ? 2 : 0,
        ...resourceData
      },
      include: {
        user: {
          include: {
            _count: {
              select: { patch_resource: true }
            }
          }
        }
      }
    })

    await prisma.user.update({
      where: { id: uid },
      data: { moemoepoint: { increment: 3 } }
    })

    if (currentPatch) {
      const updatedTypes = [...new Set(currentPatch.type.concat(type))]
      const updatedLanguages = [
        ...new Set(currentPatch.language.concat(language))
      ]
      const updatedPlatforms = [
        ...new Set(currentPatch.platform.concat(platform))
      ]

      await prisma.patch.update({
        where: { id: patchId },
        data: {
          resource_update_time: new Date(),
          type: { set: updatedTypes },
          language: { set: updatedLanguages },
          platform: { set: updatedPlatforms }
        }
      })
    }

    const resource: PatchResource = {
      id: newResource.id,
      name: newResource.name,
      section: newResource.section,
      uniqueId: currentPatch?.unique_id ?? '',
      storage: newResource.storage,
      size: newResource.size,
      type: newResource.type,
      language: newResource.language,
      note: newResource.note,
      hash: newResource.hash,
      content: newResource.content,
      code: newResource.code,
      password: newResource.password,
      platform: newResource.platform,
      likeCount: 0,
      isLike: false,
      status: newResource.status,
      userId: newResource.user_id,
      patchId: newResource.patch_id,
      created: String(newResource.created),
      user: {
        id: newResource.user.id,
        name: newResource.user.name,
        avatar: newResource.user.avatar,
        patchCount: newResource.user._count.patch_resource,
        role: newResource.user.role
      }
    }

    return resource
  })

  if (needApproval) {
    await createMessage({
      type: 'system',
      content: `你的第一个补丁资源「${currentPatch?.name ?? ''}」已提交审核，审核通过后将自动公开显示。`,
      recipient_id: uid,
      link: currentPatch?.unique_id ? `/${currentPatch.unique_id}` : '/'
    })
  }

  return resource
}
