import { z } from 'zod'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import * as fs from 'fs'
import * as path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const envPath = path.resolve(__dirname, '..', '.env')
if (!fs.existsSync(envPath)) {
  console.error('.env file not found in the project root.')
  process.exit(1)
}

config({ path: envPath })

const rawEnvSchema = z.object({
  KUN_DATABASE_URL: z.string().url(),
  KUN_VISUAL_NOVEL_SITE_URL: z.string().url(),

  NEXT_PUBLIC_KUN_PATCH_ADDRESS_DEV: z.string(),
  NEXT_PUBLIC_KUN_PATCH_ADDRESS_PROD: z.string(),

  REDIS_HOST: z.string(),
  REDIS_PORT: z.string(),
  REDIS_PASSWORD: z.string().optional(),

  JWT_ISS: z.string(),
  JWT_AUD: z.string(),
  JWT_SECRET: z.string(),

  OIDC_ISSUER: z.string().url().optional(),
  OIDC_JWKS: z.string().optional(),
  OIDC_COOKIE_KEYS: z.string().optional(),
  OIDC_SECRET_ENC_KEY: z.string().optional(),

  NODE_ENV: z.enum(['development', 'test', 'production']),

  KUN_VISUAL_NOVEL_EMAIL_FROM: z.string(),
  KUN_VISUAL_NOVEL_EMAIL_HOST: z.string(),
  KUN_VISUAL_NOVEL_EMAIL_PORT: z.string(),
  KUN_VISUAL_NOVEL_EMAIL_ACCOUNT: z.string(),
  KUN_VISUAL_NOVEL_EMAIL_PASSWORD: z.string(),

  KUN_VISUAL_NOVEL_S3_STORAGE_ACCESS_KEY_ID: z.string(),
  KUN_VISUAL_NOVEL_S3_STORAGE_SECRET_ACCESS_KEY: z.string(),
  KUN_VISUAL_NOVEL_S3_STORAGE_BUCKET_NAME: z.string(),
  KUN_VISUAL_NOVEL_S3_STORAGE_ENDPOINT: z.string(),
  KUN_VISUAL_NOVEL_S3_STORAGE_REGION: z.string(),
  NEXT_PUBLIC_KUN_VISUAL_NOVEL_S3_STORAGE_URL: z.string(),

  KUN_VISUAL_NOVEL_IMAGE_BED_HOST: z.string(),
  KUN_VISUAL_NOVEL_IMAGE_BED_URL: z.string(),

  KUN_CF_CACHE_ZONE_ID: z.string(),
  KUN_CF_CACHE_PURGE_API_TOKEN: z.string(),

  KUN_VISUAL_NOVEL_INDEX_NOW_KEY: z.string(),

  KUN_ENABLE_CRON: z.enum(['true', 'false']).optional(),
  KUN_VISUAL_NOVEL_TEST_SITE_LABEL: z.string().optional(),

  MODERATION_AI_BASE_URL: z.string().url().optional(),
  MODERATION_AI_API_KEY: z.string().optional(),
  MODERATION_AI_TEXT_MODEL: z.string().optional(),
  MODERATION_AI_VISION_MODEL: z.string().optional(),

  MEILISEARCH_HOST: z.string().url().optional(),
  MEILISEARCH_ADMIN_API_KEY: z.string().optional(),
  KUN_MEILISEARCH_ENABLED: z.enum(['true', 'false']).optional()
})

// OIDC 启用（配置了签名密钥 OIDC_JWKS）时，client_secret 加密 KEK 必填：迁移把密文落库后，
// 一旦 KEK 缺失 / 改动会导致机密 client 全部 500 且密文不可逆恢复，故启动即 fail-fast。
export const envSchema = rawEnvSchema.superRefine((value, ctx) => {
  if (value.OIDC_JWKS && !value.OIDC_SECRET_ENC_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['OIDC_SECRET_ENC_KEY'],
      message:
        'OIDC 已启用（OIDC_JWKS 非空）时 OIDC_SECRET_ENC_KEY 必填，请运行 esno scripts/generateOidcJwks.ts 生成'
    })
  }
})

export const env = envSchema.safeParse(process.env)

if (!env.success) {
  throw new Error(
    '❌ Invalid environment variables: ' +
      JSON.stringify(env.error.format(), null, 4)
  )
}
