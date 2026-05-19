import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { prisma } from '~/prisma'
import { patchCompanyChangeSchema } from '~/validations/patch'
import { invalidatePatchContentCache } from '~/app/api/patch/cache'

const handlePatchCompanyAction = (type: 'add' | 'delete') => {
  const isAdd = type === 'add'
  return async (
    input: z.infer<typeof patchCompanyChangeSchema>
  ): Promise<boolean> => {
    const { patchId, companyId } = input

    return await prisma.$transaction(async (prisma) => {
      const existing = await prisma.patch_company_relation.findMany({
        where: { patch_id: patchId, company_id: { in: companyId } },
        select: { company_id: true }
      })
      const existingIds = new Set(existing.map((r) => r.company_id))

      const affected = isAdd
        ? companyId.filter((id) => !existingIds.has(id))
        : companyId.filter((id) => existingIds.has(id))

      if (affected.length === 0) {
        return false
      }

      if (isAdd) {
        await prisma.patch_company_relation.createMany({
          data: affected.map((id) => ({
            patch_id: patchId,
            company_id: id
          }))
        })
      } else {
        await prisma.patch_company_relation.deleteMany({
          where: { patch_id: patchId, company_id: { in: affected } }
        })
      }

      await prisma.patch_company.updateMany({
        where: { id: { in: affected } },
        data: { count: { increment: isAdd ? 1 : -1 } }
      })

      return true
    })
  }
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, patchCompanyChangeSchema)
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

  const patch = await prisma.patch.findUnique({
    where: { id: input.patchId },
    select: { unique_id: true }
  })
  if (!patch) {
    return NextResponse.json('未找到 Galgame')
  }

  const changed = await handlePatchCompanyAction('add')(input)
  if (changed) {
    try {
      await invalidatePatchContentCache(patch.unique_id)
    } catch {
      // 缓存失效失败不影响所属会社更新结果
    }
  }
  return NextResponse.json({})
}

export const PUT = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, patchCompanyChangeSchema)
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

  const patch = await prisma.patch.findUnique({
    where: { id: input.patchId },
    select: { unique_id: true }
  })
  if (!patch) {
    return NextResponse.json('未找到 Galgame')
  }

  const changed = await handlePatchCompanyAction('delete')(input)
  if (changed) {
    try {
      await invalidatePatchContentCache(patch.unique_id)
    } catch {
      // 缓存失效失败不影响所属会社更新结果
    }
  }
  return NextResponse.json({})
}
