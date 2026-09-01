import { randomBytes } from 'crypto'
import { takeKv } from '~/lib/redis'
import {
  KUN_CAPTCHA_VERIFY_TOKEN_BYTES,
  kunCaptchaVerifyTokenRegex
} from '~/constants/captcha'

export const generateCaptchaVerifyToken = () => {
  return randomBytes(KUN_CAPTCHA_VERIFY_TOKEN_BYTES).toString('hex')
}

// 令牌是"一次解题=一次尝试"的闸门, 必须原子消费, 否则同一令牌可并发重放
export const checkKunCaptchaExist = async (sessionId: string) => {
  const captchaToken = sessionId.trim()
  if (!kunCaptchaVerifyTokenRegex.test(captchaToken)) {
    return false
  }

  return takeKv(`captcha:verify:${captchaToken}`)
}
