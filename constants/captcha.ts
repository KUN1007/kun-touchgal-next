export const KUN_CAPTCHA_VERIFY_TOKEN_BYTES = 16
export const KUN_CAPTCHA_VERIFY_TOKEN_TTL_SECONDS = 60 * 60
export const kunCaptchaVerifyTokenRegex = /^[a-f0-9]{32}$/

export const kunCaptchaErrorMessageMap: Record<number, string> = {
  1: '杂鱼 ~ 连白毛老婆都分辨不出来了吗',
  2: '杂鱼 ~ 怎么又选错了!',
  3: '杂鱼 ~ 八嘎 ~ 杂鱼 ~ 臭杂鱼 ~',
  4: '臭杂鱼 ~ 做不对验证的臭杂鱼 ~',
  5: '八嘎八嘎八嘎八嘎八嘎八嘎八嘎八嘎',
  6: '杂鱼 ~ 你不会是机器人吧'
}
