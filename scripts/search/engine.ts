import 'dotenv/config'
import { execSync } from 'child_process'

const HEALTH_TIMEOUT_MS = 60000
const HEALTH_INTERVAL_MS = 1000
const HEALTH_REQUEST_TIMEOUT_MS = 5000

const waitForHealth = async (host: string) => {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS
  for (;;) {
    try {
      const res = await fetch(`${host}/health`, {
        signal: AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS)
      })
      if (res.ok) {
        const body = (await res.json()) as { status?: string }
        if (body.status === 'available') {
          return
        }
      }
    } catch {
      // 引擎冷启动中，尚未监听，继续轮询
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Meilisearch 在 ${HEALTH_TIMEOUT_MS}ms 内未就绪: ${host}/health`
      )
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_INTERVAL_MS))
  }
}

const bringUpEngine = async () => {
  if (!process.env.MEILISEARCH_ADMIN_API_KEY) {
    throw new Error(
      '未配置 MEILISEARCH_ADMIN_API_KEY，无法启动搜索引擎（MEILI_ENV=production 要求 master key）'
    )
  }
  const host = process.env.MEILISEARCH_HOST ?? 'http://127.0.0.1:7700'

  execSync('docker compose up -d meilisearch', {
    stdio: 'inherit',
    env: process.env
  })
  console.log('等待 Meilisearch 就绪...')
  await waitForHealth(host)
  console.log(`Meilisearch 已就绪: ${host}`)
}

bringUpEngine()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
