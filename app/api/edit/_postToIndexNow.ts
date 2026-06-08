import { kunMoyuMoe } from '~/config/moyu-moe'

const INDEX_NOW_TIMEOUT_MS = 3000

interface IndexNow {
  host: string
  key: string
  keyLocation: string
  urlList: string[]
}

export const postToIndexNow = async (url: string) => {
  const requestData: IndexNow = {
    host: kunMoyuMoe.domain.main,
    key: process.env.KUN_VISUAL_NOVEL_INDEX_NOW_KEY || '',
    keyLocation: `${kunMoyuMoe.domain.main}/${process.env.KUN_VISUAL_NOVEL_INDEX_NOW_KEY}.txt`,
    urlList: [url]
  }

  const response = await fetch('https://www.bing.com/indexnow', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': kunMoyuMoe.titleShort
    },
    body: JSON.stringify(requestData),
    signal: AbortSignal.timeout(INDEX_NOW_TIMEOUT_MS)
  })

  if (!response.ok) {
    throw new Error(
      `IndexNow request failed with ${response.status} ${response.statusText}`
    )
  }
}
