import { getRemoteIp } from './getRemoteIp'
import { getKv, setKv } from '~/lib/redis'
import { generateRandomString } from '~/utils/random'
import { kunMoyuMoe } from '~/config/moyu-moe'
import { createKunVerificationEmailTemplate } from '~/constants/email/verify-templates'

export const sendVerificationCodeEmail = async (
  headers: Headers,
  email: string,
  type: 'register' | 'forgot' | 'reset'
) => {
  const ip = getRemoteIp(headers)

  const limitEmail = await getKv(`limit:email:${email}`)
  const limitIP = await getKv(`limit:ip:${ip}`)
  if (limitEmail || limitIP) {
    return '您发送邮件的频率太快了, 请 60 秒后重试'
  }

  const code = generateRandomString(7)

  await setKv(email, code, 10 * 60)
  await setKv(`limit:email:${email}`, code, 60)
  await setKv(`limit:ip:${ip}`, code, 60)

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
        subject: `${kunMoyuMoe.titleShort} - 验证码`,
        tag: 'verification-code',
        html_body: createKunVerificationEmailTemplate(type, code),
        plain_body: `您的验证码是：${code}，10 分钟内有效`
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
