import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto'

// OIDC client_secret 落库加密：AES-256-GCM，KEK 由 OIDC_SECRET_ENC_KEY 经 SHA-256 派生成 32 字节。
// 存储格式 `gcm:` + base64url(iv(12) ‖ ciphertext ‖ tag(16))；无前缀视为历史明文，按原样返回，
// 保证迁移前后可平滑读取（仿 kun-galgame-infra 私钥 at-rest 加密与 legacy 明文回退）。
// oidc-provider 校验 client_secret_basic/post 需要明文，故只能加密落库、在 adapter.find() 解密，
// 不能像 infra 那样只存哈希。
const SCHEME_PREFIX = 'gcm:'
const IV_BYTES = 12
const TAG_BYTES = 16

const deriveKek = () => {
  const secret = process.env.OIDC_SECRET_ENC_KEY
  if (!secret) {
    throw new Error('OIDC_SECRET_ENC_KEY 未配置，无法加解密 OIDC client_secret')
  }
  return createHash('sha256').update(secret).digest()
}

export const isEncryptedClientSecret = (stored: string) =>
  stored.startsWith(SCHEME_PREFIX)

export const encryptClientSecret = (plaintext: string) => {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', deriveKek(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return SCHEME_PREFIX + Buffer.concat([iv, enc, tag]).toString('base64url')
}

export const decryptClientSecret = (stored: string) => {
  if (!isEncryptedClientSecret(stored)) {
    return stored
  }
  const raw = Buffer.from(stored.slice(SCHEME_PREFIX.length), 'base64url')
  const iv = raw.subarray(0, IV_BYTES)
  const tag = raw.subarray(raw.length - TAG_BYTES)
  const enc = raw.subarray(IV_BYTES, raw.length - TAG_BYTES)
  const decipher = createDecipheriv('aes-256-gcm', deriveKek(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    'utf8'
  )
}
