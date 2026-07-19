export const KUN_CAPTCHA_VERIFY_TOKEN_BYTES = 16
export const KUN_CAPTCHA_VERIFY_TOKEN_TTL_SECONDS = 60 * 60
export const kunCaptchaVerifyTokenRegex = /^[a-f0-9]{32}$/

// capjs-core 挑战的 scope, 防止其它 Cap 部署签发的挑战跨站复用
export const KUN_CAP_CHALLENGE_SCOPE = 'kun-captcha'
