import { NextRequest, NextResponse } from 'next/server'
import { kunParseFormData, kunParsePutBody } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { patchCreateSchema, patchUpdateSchema } from '~/validations/edit'
import { createGalgame } from './create'
import { updateGalgame } from './update'
import { VNDBRegex } from '~/utils/validate'

const checkAliasValid = (aliasString: string) => {
  const aliasArray = JSON.parse(aliasString) as string[]
  if (aliasArray.length > 30) {
    return '您最多使用 30 个别名'
  }
  const maxLength = aliasArray.some((alias) => alias.length > 500)
  if (maxLength) {
    return '单个别名的长度不可超过 500 个字符'
  }
  const minLength = aliasArray.some((alias) => alias.trim.length)
  if (minLength) {
    return '单个别名至少一个字符'
  }
  return aliasArray.map((a) => a.trim())
}

export const POST = async (req: NextRequest) => {
  const input = await kunParseFormData(req, patchCreateSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }
  if (payload.role < 2 && !VNDBRegex.test(input.vndbId ?? '')) {
    return NextResponse.json(
      '为防止恶意发布, 仅限创作者可以不填写 VNDB ID 发布游戏'
    )
  }

  const { alias, banner, ...rest } = input
  const res = checkAliasValid(alias)
  if (typeof res === 'string') {
    return NextResponse.json(res)
  }
  const bannerArrayBuffer = await new Response(banner)?.arrayBuffer()

  const response = await createGalgame(
    { alias: res, banner: bannerArrayBuffer, ...rest },
    payload.uid
  )
  return NextResponse.json(response)
}

export const PUT = async (req: NextRequest) => {
  const input = await kunParsePutBody(req, patchUpdateSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  const response = await updateGalgame(input, payload.uid)
  return NextResponse.json(response)
}
