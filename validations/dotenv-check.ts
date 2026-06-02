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

export const envSchema = z.object({
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
  KUN_VISUAL_NOVEL_TEST_SITE_LABEL: z.string().optional()
})

export const env = envSchema.safeParse(process.env)

if (!env.success) {
  throw new Error(
    '❌ Invalid environment variables: ' +
      JSON.stringify(env.error.format(), null, 4)
  )
}
