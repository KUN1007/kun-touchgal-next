import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { getKv } from '~/lib/redis'
import { headObject } from '~/lib/s3'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { verifyKunCsrf } from '~/middleware/_csrf'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'

const MAX_FILE_SIZE = 100 * 1024 * 1024

const completeSchema = z.object({
  token: z.string().min(8).max(128)
})

interface UploadTokenMeta {
  s3Key: string
  fileName: string
  declared: number
  uid: number
}

export async function POST(req: NextRequest) {
  const csrfError = verifyKunCsrf(req)
  if (csrfError) {
    return NextResponse.json(csrfError, { status: 403 })
  }

  const input = await kunParsePostBody(req, completeSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未认证')
  }

  const raw = await getKv(`upload:${input.token}`)
  if (!raw) {
    return NextResponse.json('上传 token 已过期或不存在, 请重新上传')
  }

  const meta = JSON.parse(raw) as UploadTokenMeta
  if (meta.uid !== payload.uid) {
    return NextResponse.json('上传 token 不属于当前用户')
  }

  const info = await headObject(meta.s3Key).catch(() => null)
  if (!info) {
    return NextResponse.json('文件未上传成功, 请重试')
  }

  const actualSize = Number(info.ContentLength ?? 0)
  if (actualSize !== meta.declared) {
    return NextResponse.json('文件大小不一致, 请重新上传')
  }
  if (actualSize > MAX_FILE_SIZE) {
    return NextResponse.json('文件大小超过限制, 最大为 100 MB')
  }

  const fileSizeMB = actualSize / (1024 * 1024)

  return NextResponse.json({
    filetype: 's3',
    fileToken: input.token,
    fileSize: `${fileSizeMB.toFixed(3)} MB`
  })
}
