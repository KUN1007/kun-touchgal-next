import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { kunParsePostBody, kunParsePutBody } from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { patchTagChangeSchema } from '~/validations/patch'

const handleAddPatchTag = async (
  input: z.infer<typeof patchTagChangeSchema>
) => {
  const { patchId, tagId } = input

  return await prisma.$transaction(async (prisma) => {
    const existing = await prisma.patch_tag_relation.findMany({
      where: { patch_id: patchId, tag_id: { in: tagId } },
      select: { tag_id: true }
    })
    const existingIds = new Set(existing.map((r) => r.tag_id))
    const toCreate = tagId.filter((id) => !existingIds.has(id))

    if (toCreate.length === 0) {
      return {}
    }

    await prisma.patch_tag_relation.createMany({
      data: toCreate.map((id) => ({ patch_id: patchId, tag_id: id }))
    })

    await prisma.patch_tag.updateMany({
      where: { id: { in: toCreate } },
      data: { count: { increment: 1 } }
    })
    return {}
  })
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, patchTagChangeSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }
  if (payload.role < 3) {
    return NextResponse.json('本页面仅管理员可访问')
  }

  const response = await handleAddPatchTag(input)
  return NextResponse.json(response)
}

const handleRemovePatchTag = async (
  input: z.infer<typeof patchTagChangeSchema>
) => {
  const { patchId, tagId } = input

  return await prisma.$transaction(async (prisma) => {
    const existing = await prisma.patch_tag_relation.findMany({
      where: { patch_id: patchId, tag_id: { in: tagId } },
      select: { tag_id: true }
    })
    const toDelete = existing.map((r) => r.tag_id)

    if (toDelete.length === 0) {
      return {}
    }

    await prisma.patch_tag_relation.deleteMany({
      where: { patch_id: patchId, tag_id: { in: toDelete } }
    })

    await prisma.patch_tag.updateMany({
      where: { id: { in: toDelete } },
      data: { count: { decrement: 1 } }
    })
    return {}
  })
}

export const PUT = async (req: NextRequest) => {
  const input = await kunParsePutBody(req, patchTagChangeSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }
  if (payload.role < 3) {
    return NextResponse.json('本页面仅管理员可访问')
  }

  const response = await handleRemovePatchTag(input)
  return NextResponse.json(response)
}
