import { execSync } from 'child_process'
import { config } from 'dotenv'
import { envSchema } from '../validations/dotenv-check'
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

try {
  envSchema.safeParse(process.env)

  console.log('Environment variables are valid.')
  console.log('Executing the commands...')

  if (process.env.KUN_VISUAL_NOVEL_TEST_SITE_LABEL) {
    console.log('DANGEROUS❗❗❗❗❗❗❗❗❗❗❗❗❗❗❗')
    console.log(
      'You website is running on a test environment now, it will be disable any search engine indexing!'
    )
  }

  execSync(
    'git pull && pnpm i && pnpm prisma:push && pnpm build && pnpm stop && pnpm start',
    { stdio: 'inherit' }
  )
} catch (e) {
  console.error('Invalid environment variables')
  process.exit(1)
}
