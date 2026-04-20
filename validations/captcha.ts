import { z } from 'zod'
import { kunCaptchaVerifyTokenRegex } from '~/constants/captcha'

export const captchaVerifyTokenSchema = z
  .string()
  .trim()
  .regex(kunCaptchaVerifyTokenRegex, { message: '非法的人机验证码格式' })
