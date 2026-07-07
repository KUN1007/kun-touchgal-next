import { Meilisearch } from 'meilisearch'

let client: Meilisearch | null = null

export const getMeiliClient = () => {
  const host = process.env.MEILISEARCH_HOST
  const apiKey = process.env.MEILISEARCH_ADMIN_API_KEY
  if (!host || !apiKey) {
    return null
  }
  if (!client) {
    client = new Meilisearch({ host, apiKey })
  }
  return client
}

export const isMeiliEnabled = () =>
  process.env.KUN_MEILISEARCH_ENABLED === 'true' && !!getMeiliClient()
