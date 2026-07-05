import { randomUUID } from 'crypto'
import { getRemoteIp } from './getRemoteIp'
import { getKv, setKv } from '~/lib/redis'
import { kunMoyuMoe } from '~/config/moyu-moe'
import { createKunResetPasswordEmailTemplate } from '~/constants/email/verify-templates'

export const FORGOT_PASSWORD_RESET_TTL_SECONDS = 30 * 60

export const createForgotPasswordResetKey = (token: string) =>
  `forgot:reset:${token}`

export type ForgotPasswordResetPayload = {
  uid: number
  email: string
}

const getSiteAddress = () => {
  const envAddress =
    process.env.NODE_ENV === 'development'
      ? process.env.NEXT_PUBLIC_KUN_PATCH_ADDRESS_DEV
      : process.env.NEXT_PUBLIC_KUN_PATCH_ADDRESS_PROD

  return envAddress || kunMoyuMoe.domain.main
}

export const sendResetPasswordLinkEmail = async (
  headers: Headers,
  uid: number,
  email: string
) => {
  const ip = getRemoteIp(headers)

  const limitEmail = await getKv(`limit:email:${email}`)
  const limitIP = await getKv(`limit:ip:${ip}`)
  if (limitEmail || limitIP) {
    return '您发送邮件的频率太快了, 请 60 秒后重试'
  }

  const token = randomUUID()
  const payload: ForgotPasswordResetPayload = { uid, email }

  await setKv(
    createForgotPasswordResetKey(token),
    JSON.stringify(payload),
    FORGOT_PASSWORD_RESET_TTL_SECONDS
  )
  await setKv(`limit:email:${email}`, '1', 60)
  await setKv(`limit:ip:${ip}`, '1', 60)

  const resetLink = `${getSiteAddress()}/auth/forgot/reset?token=${encodeURIComponent(token)}`

  const res = await fetch(
    `${process.env.KUN_VISUAL_NOVEL_EMAIL_HOST}/api/v1/send/message`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Server-API-Key': process.env.KUN_VISUAL_NOVEL_EMAIL_PASSWORD || '',
        Authorization: `Bearer ${process.env.KUN_VISUAL_NOVEL_EMAIL_PASSWORD}`
      },
      body: JSON.stringify({
        to: [email],
        from: process.env.KUN_VISUAL_NOVEL_EMAIL_ACCOUNT,
        sender: `${process.env.KUN_VISUAL_NOVEL_EMAIL_FROM}<${process.env.KUN_VISUAL_NOVEL_EMAIL_ACCOUNT}>`,
        subject: `${kunMoyuMoe.titleShort} - 重置密码`,
        tag: 'reset-password',
        html_body: createKunResetPasswordEmailTemplate(resetLink),
        plain_body: `我们收到了您重置密码的请求, 请在 30 分钟内访问此链接设置新密码: ${resetLink}`
      })
    }
  )

  if (!res.ok) {
    const text = await res.text()
    return text
  }

  const r = await res.json()
  if (r.status === 'error') {
    return JSON.stringify(r)
  }
}
