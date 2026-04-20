import { z } from 'zod'
import {
  kunUsernameRegex,
  kunPasswordRegex,
  kunValidMailConfirmCodeRegex
} from '~/utils/validate'

export const stepOneSchema = z.object({
  name: z
    .string()
    .trim()
    .email({ message: '请输入合法的邮箱格式, 用户名则应为 1~17 位任意字符' })
    .or(
      z.string().trim().regex(kunUsernameRegex, {
        message: '非法的用户名，用户名为 1~17 位任意字符'
      })
    ),
  captcha: z
    .string()
    .trim()
    .min(10, { message: '非法的人机验证码格式' })
    .max(10)
})

export const stepTwoSchema = z.object({
  name: z
    .string()
    .trim()
    .email({ message: '请输入合法的邮箱格式, 用户名则应为 1~17 位任意字符' })
    .or(
      z.string().trim().regex(kunUsernameRegex, {
        message: '非法的用户名，用户名为 1~17 位任意字符'
      })
    ),
  verificationCode: z
    .string()
    .regex(kunValidMailConfirmCodeRegex, { message: '邮箱验证码格式无效' }),
  newPassword: z.string().regex(kunPasswordRegex, {
    message:
      '新密码格式错误, 密码的长度为 6 到 107 位，必须包含至少一个英文字符和一个数字，可以选择性的包含 @!#$%^&*()_-+=\\/ 等特殊字符'
  }),
  confirmPassword: z.string().regex(kunPasswordRegex, {
    message:
      '确认密码格式错误, 密码的长度为 6 到 107 位，必须包含至少一个英文字符和一个数字，可以选择性的包含 @!#$%^&*()_-+=\\/ 等特殊字符'
  })
})
