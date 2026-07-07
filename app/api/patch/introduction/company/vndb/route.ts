import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { prisma } from '~/prisma/index'
import { ensurePatchCompaniesFromVNDB } from '~/app/api/edit/fetchCompanies'
import { queueSearchSync } from '~/server/search/sync'

const fetchCompanySchema = z.object({
  patchId: z.coerce.number().min(1).max(9999999)
})

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, fetchCompanySchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }
  if (payload.role < 3) {
    return NextResponse.json('您没有权限执行此操作')
  }

  const patch = await prisma.patch.findUnique({
    where: { id: input.patchId },
    select: { vndb_id: true }
  })

  if (!patch) {
    return NextResponse.json('未找到对应的游戏')
  }

  if (!patch.vndb_id) {
    return NextResponse.json('该游戏没有关联 VNDB ID')
  }

  const result = await ensurePatchCompaniesFromVNDB(
    input.patchId,
    patch.vndb_id,
    payload.uid
  )

  if (result.related === 0) {
    return NextResponse.json('未能从 VNDB 获取到会社信息')
  }

  queueSearchSync(input.patchId)

  const companies = await prisma.patch_company.findMany({
    where: {
      patch_relations: {
        some: { patch_id: input.patchId }
      }
    },
    select: {
      id: true,
      name: true,
      count: true
    }
  })

  return NextResponse.json({
    message: `成功关联 ${result.related} 个会社`,
    companies
  })
}
