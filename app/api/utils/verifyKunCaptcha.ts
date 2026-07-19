import { randomBytes } from 'crypto'
import { delKv, getKv } from '~/lib/redis'
import {
  KUN_CAPTCHA_VERIFY_TOKEN_BYTES,
  kunCaptchaVerifyTokenRegex
} from '~/constants/captcha'

export const generateCaptchaVerifyToken = () => {
  return randomBytes(KUN_CAPTCHA_VERIFY_TOKEN_BYTES).toString('hex')
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
