import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { prisma } from '~/prisma'
import { patchCompanyChangeSchema } from '~/validations/patch'

export const handlePatchCompanyAction = (type: 'add' | 'delete') => {
  const isAdd = type === 'add'
  return async (input: z.infer<typeof patchCompanyChangeSchema>) => {
    const { patchId, companyId } = input

    return await prisma.$transaction(async (prisma) => {
      if (isAdd) {
        await prisma.patch_company_relation.createMany({
          data: companyId.map((id) => ({
            patch_id: patchId,
            company_id: id
          }))
        })
      } else {
        await prisma.patch_company_relation.deleteMany({
          where: { patch_id: patchId, company_id: { in: companyId } }
        })
      }

      await prisma.patch_company.updateMany({
        where: { id: { in: companyId } },
        data: { count: { increment: isAdd ? 1 : -1 } }
      })

      return {}
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

  const response = await handlePatchCompanyAction('add')(input)
  return NextResponse.json(response)
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

  const response = await handlePatchCompanyAction('delete')(input)
  return NextResponse.json(response)
}
