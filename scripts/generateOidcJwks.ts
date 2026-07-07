import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { generateKeyPair, exportJWK, calculateJwkThumbprint } from 'jose'

// 一次性脚本：生成 OIDC Provider 的 RS256 签名密钥（JWK Set）与 cookie 密钥，
// 幂等写入 .env 的 OIDC_JWKS / OIDC_COOKIE_KEYS（已有非空值则跳过）。
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
  if (hasValue(content, 'OIDC_JWKS') && hasValue(content, 'OIDC_COOKIE_KEYS')) {
    console.log('OIDC_JWKS / OIDC_COOKIE_KEYS 已存在非空值，跳过生成')
    return
  }

  const { privateKey } = await generateKeyPair('RS256', { extractable: true })
  const jwk = await exportJWK(privateKey)
  jwk.use = 'sig'
  jwk.alg = 'RS256'
  jwk.kid = await calculateJwkThumbprint(jwk)

  content = upsertEnv(content, 'OIDC_JWKS', JSON.stringify({ keys: [jwk] }))
  content = upsertEnv(
    content,
    'OIDC_COOKIE_KEYS',
    `${randomUUID()},${randomUUID()}`
  )
  writeFileSync(ENV_PATH, content)
  console.log(`已写入 OIDC_JWKS / OIDC_COOKIE_KEYS 到 .env（kid=${jwk.kid}）`)
}

main()
