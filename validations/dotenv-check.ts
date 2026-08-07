import { config } from 'dotenv'
// 相对导入: 本文件被 next.config.ts 的加载器直接转译, 不解析 ~ 别名
// 纯 schema 在 env-schema.ts (无副作用, 供测试直接 import), 本文件只承载
// 读 .env + safeParse(process.env) 的 fail-fast 副作用
import { envSchema } from './env-schema'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import * as fs from 'fs'
import * as path from 'path'

// 不要命名为 __filename / __dirname: next.config.ts 的加载器会把本文件 SWC 转译为 CJS,
// 与 module wrapper 的同名参数冲突 (SyntaxError, 且会被 Node 的模块探测掩盖成
// "exports is not defined in ES module scope")
const selfDirname = dirname(fileURLToPath(import.meta.url))

const envPath = path.resolve(selfDirname, '..', '.env')
if (!fs.existsSync(envPath)) {
  console.error('.env file not found in the project root.')
  process.exit(1)
}

config({ path: envPath })

export const env = envSchema.safeParse(process.env)

if (!env.success) {
  throw new Error(
    '❌ Invalid environment variables: ' +
      JSON.stringify(env.error.format(), null, 4)
  )
}
