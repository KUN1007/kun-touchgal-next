import { randomBytes } from 'crypto'
import { delKv, getKv, setKv } from '~/lib/redis'
import {
  KUN_CAPTCHA_VERIFY_TOKEN_BYTES,
  KUN_CAPTCHA_VERIFY_TOKEN_TTL_SECONDS,
  kunCaptchaVerifyTokenRegex
} from '~/constants/captcha'

const generateCaptchaVerifyToken = () => {
  return randomBytes(KUN_CAPTCHA_VERIFY_TOKEN_BYTES).toString('hex')
}

export const verifyKunCaptcha = async (
  sessionId: string,
  selectedIds: string[]
) => {
  const session = await getKv(`captcha:generate:${sessionId}`)

  await delKv(`captcha:generate:${sessionId}`)

  if (!session) {
    return '未找到您的验证请求, 请重新验证'
  }

  const correctIdsArray: string[] = JSON.parse(session)

  const isCorrect =
    selectedIds.length === correctIdsArray.length &&
    selectedIds.every((id) => correctIdsArray.includes(id))
  if (!isCorrect) {
    return '您选择的白毛女孩子不正确, 请重试'
  }

  const randomCode = generateCaptchaVerifyToken()
  await setKv(
    `captcha:verify:${randomCode}`,
    'captcha',
    KUN_CAPTCHA_VERIFY_TOKEN_TTL_SECONDS
  )

  return { code: randomCode }
}

export const checkKunCaptchaExist = async (sessionId: string) => {
  const captchaToken = sessionId.trim()
  if (!kunCaptchaVerifyTokenRegex.test(captchaToken)) {
    return
  }

  const captcha = await getKv(`captcha:verify:${captchaToken}`)
  if (captcha) {
    await delKv(`captcha:verify:${captchaToken}`)
    return captcha
  }
}
