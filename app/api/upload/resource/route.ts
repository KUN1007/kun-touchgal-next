import { NextRequest, NextResponse } from 'next/server'
import { setKv } from '~/lib/redis'
import { calculateFileStreamHash } from '../resourceUtils'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { ALLOWED_EXTENSIONS } from '~/constants/resource'
import { sanitizeFileName } from '~/utils/sanitizeFileName'
import { prisma } from '~/prisma'
import { checkKunCaptchaExist } from '~/app/api/utils/verifyKunCaptcha'

const getFileExtension = (filename: string) => {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase()
}

const checkRequestValid = async (req: NextRequest) => {
  const formData = await req.formData()
  const file = formData.get('file')
  const captcha = formData.get('captcha')

  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return '用户未认证'
  }

  if (!file || !(file instanceof File)) {
    return '错误的文件输入'
  }

  const fileExtension = getFileExtension(file.name)
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return `不支持的文件类型: ${fileExtension}`
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileSizeInMB = buffer.length / (1024 * 1024)

  if (fileSizeInMB < 0.001) {
    return '文件过小, 您的文件小于 0.001 MB'
  }
  if (fileSizeInMB > 100) {
    return '文件大小超过限制, 最大为 100 MB'
  }

  const user = await prisma.user.findUnique({ where: { id: payload.uid } })
  if (!user) {
    return '用户未找到'
  }
  if (user.moemoepoint < 20) {
    return '仅限萌萌点大于 20 的用户才可以发布资源'
  }
  if (user.role < 2) {
    return '您的权限不足, 创作者或者管理员才可以上传文件到对象存储'
  }
  if (user.role === 2) {
    const res = await checkKunCaptchaExist(String(captcha))
    if (!res) {
      return '人机验证无效, 请完成人机验证'
    }
  }
  if (user.daily_upload_size >= 5120) {
    return '您今日的上传大小已达到 5GB 限额'
  }
  const resource = await prisma.patch_resource.findFirst({
    where: { user_id: payload.uid, status: 2 }
  })
  if (resource) {
    return '您有至少一个 Galgame 资源在待审核阶段, 请等待审核结束后再发布资源'
  }

  const fileSizeInGB = Number(fileSizeInMB.toFixed(3))
  await prisma.user.update({
    where: { id: payload.uid },
    data: { daily_upload_size: { increment: fileSizeInGB } }
  })

  return { buffer, file, fileSizeInMB }
}

export async function POST(req: NextRequest) {
  const validData = await checkRequestValid(req)
  if (typeof validData === 'string') {
    return NextResponse.json(validData)
  }

  const { buffer, file, fileSizeInMB } = validData

  const fileName = sanitizeFileName(file.name)
  const res = await calculateFileStreamHash(buffer, 'uploads', fileName)

  await setKv(res.fileHash, res.finalFilePath, 24 * 60 * 60)

  return NextResponse.json({
    filetype: 's3',
    fileHash: res.fileHash,
    fileSize: `${fileSizeInMB.toFixed(3)} MB`
  })
}
