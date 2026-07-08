import { randomBytes, randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { generateKeyPair, exportJWK, calculateJwkThumbprint } from 'jose'

// 一次性脚本：生成 OIDC Provider 的 RS256 签名密钥（JWK Set）、cookie 密钥与
// client_secret 加密 KEK，幂等写入 .env 的 OIDC_JWKS / OIDC_COOKIE_KEYS /
// OIDC_SECRET_ENC_KEY（各自已有非空值则跳过）。
// 运行：pnpm exec esno scripts/generateOidcJwks.ts
const ENV_PATH = resolve(process.cwd(), '.env')

const hasValue = (content: string, key: string) => {
  const match = content.match(
    new RegExp(`^${key}\\s*=\\s*['"]?([^'"\\n]+)`, 'm')
  )
  return Boolean(match && match[1] && match[1].trim())
}

const upsertEnv = (content: string, key: string, value: string) => {
  const line = `${key} = '${value}'`
  const re = new RegExp(`^${key}\\s*=.*$`, 'm')
  if (re.test(content)) {
    return content.replace(re, line)
  }
  const sep = content.endsWith('\n') || content.length === 0 ? '' : '\n'
  return `${content}${sep}${line}\n`
}

const main = async () => {
  if (!existsSync(ENV_PATH)) {
    console.error('.env 不存在，请先创建 .env')
    process.exit(1)
  }

  let content = readFileSync(ENV_PATH, 'utf-8')
  const needJwks =
    !hasValue(content, 'OIDC_JWKS') || !hasValue(content, 'OIDC_COOKIE_KEYS')
  const needEncKey = !hasValue(content, 'OIDC_SECRET_ENC_KEY')
  if (!needJwks && !needEncKey) {
    console.log(
      'OIDC_JWKS / OIDC_COOKIE_KEYS / OIDC_SECRET_ENC_KEY 已存在非空值，跳过生成'
    )
    return
  }

  let kid = ''
  if (needJwks) {
    const { privateKey } = await generateKeyPair('RS256', { extractable: true })
    const jwk = await exportJWK(privateKey)
    jwk.use = 'sig'
    jwk.alg = 'RS256'
    jwk.kid = await calculateJwkThumbprint(jwk)
    kid = jwk.kid
    content = upsertEnv(content, 'OIDC_JWKS', JSON.stringify({ keys: [jwk] }))
    content = upsertEnv(
      content,
      'OIDC_COOKIE_KEYS',
      `${randomUUID()},${randomUUID()}`
    )
  }
  if (needEncKey) {
    content = upsertEnv(
      content,
      'OIDC_SECRET_ENC_KEY',
      randomBytes(32).toString('base64url')
    )
  }
  writeFileSync(ENV_PATH, content)
  console.log(
    `已更新 .env 的 OIDC 密钥${needJwks ? `（JWKS kid=${kid}）` : ''}`
  )
}

main()
