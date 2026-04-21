export const KUN_EMAIL_DOMAIN_WHITELIST: string[] = [
  'qq.com',
  'vip.qq.com',
  'foxmail.com',
  '163.com',
  '126.com',
  'yeah.net',
  'vip.163.com',
  'sina.com',
  'sina.cn',
  'sohu.com',
  'aliyun.com',
  '139.com',
  '189.cn',
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'yahoo.com',
  'proton.me',
  'pm.me',
  'protonmail.com',
  'yandex.com',
  'zoho.com'
]

const KUN_EMAIL_DOMAIN_WHITELIST_SET = new Set(
  KUN_EMAIL_DOMAIN_WHITELIST.map((domain) => domain.toLowerCase())
)

export const isKunWhitelistedEmailDomain = (email: string): boolean => {
  const atIndex = email.lastIndexOf('@')
  if (atIndex === -1) {
    return false
  }
  const domain = email.slice(atIndex + 1).trim().toLowerCase()
  return KUN_EMAIL_DOMAIN_WHITELIST_SET.has(domain)
}
