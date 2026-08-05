import { getRemoteIp } from './getRemoteIp'
import { sendKunEmail } from './sendKunEmail'
import { getKv, setKv } from '~/lib/redis'
import { generateRandomString } from '~/utils/random'
import { kunMoyuMoe } from '~/config/moyu-moe'
import { createKunVerificationEmailTemplate } from '~/constants/email/verify-templates'

export const sendVerificationCodeEmail = async (
  headers: Headers,
  email: string,
  type: 'register' | 'reset'
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

  return sendKunEmail({
    to: [email],
    subject: `${kunMoyuMoe.titleShort} - 验证码`,
    tag: 'verification-code',
    html_body: createKunVerificationEmailTemplate(type, code),
    plain_body: `您的验证码是：${code}，10 分钟内有效`
  })
}
