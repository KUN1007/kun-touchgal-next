import { z } from 'zod'
import {
  MODERATION_AI_MAX_TOKENS,
  MODERATION_AI_TIMEOUT_MS,
  MODERATION_AVATAR_SYSTEM_PROMPT,
  MODERATION_TEXT_SYSTEM_PROMPT
} from '~/constants/moderation'
import type { ModerationContentType } from '~/constants/moderation'

// configuration problems (missing env) should send the task to manual
// review instead of burning retries
export class ModerationConfigError extends Error {}

// prompt 要求输出 boolean, 但同时容忍 0/1: 模型偶尔的形态波动不该让整条内容
// 走完三次重试再转人工
const verdictFlag = z
  .union([z.boolean(), z.literal(0), z.literal(1)])
  .transform((value) => value === true || value === 1)

export const moderationVerdictSchema = z.object({
  pass: verdictFlag,
  code: z.string().max(10).optional(),
  reason: z.string().max(100).optional(),
  manual: verdictFlag.optional()
})

export type ModerationVerdict = z.infer<typeof moderationVerdictSchema>

export interface ModerationAiResult {
  verdict: ModerationVerdict
  model: string
  tokensIn: number
  tokensOut: number
}

export const parseModerationVerdict = (raw: string): ModerationVerdict => {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(
      `Moderation verdict is not valid JSON: ${raw.slice(0, 200)}`
    )
  }

  const verdict = moderationVerdictSchema.safeParse(parsed)
  if (!verdict.success) {
    throw new Error(`Invalid moderation verdict shape: ${raw.slice(0, 200)}`)
  }
  return verdict.data
}

type ChatMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >

const requestChatCompletion = async (
  model: string,
  messages: Array<{ role: 'system' | 'user'; content: ChatMessageContent }>
): Promise<ModerationAiResult> => {
  const baseUrl = process.env.MODERATION_AI_BASE_URL
  const apiKey = process.env.MODERATION_AI_API_KEY
  if (!baseUrl || !apiKey) {
    throw new ModerationConfigError(
      'MODERATION_AI_BASE_URL or MODERATION_AI_API_KEY is not configured'
    )
  }

  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    // 单次调用超时: 约束任务处理耗时在锁 TTL 内 (见 MODERATION_AI_TIMEOUT_MS); 超时会
    // abort 请求与响应体读取, 抛错后由 worker 走退避重试, 而非无限占用 worker
    signal: AbortSignal.timeout(MODERATION_AI_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      // 走 SSE 流式: Cloudflare 免费版 ~100s 无数据即 504, 非流式下慢推理模型必超;
      // 流式响应持续推 delta (网关注入的心跳同理), 只要流不断就不会触发该超时
      stream: true,
      // 见 MODERATION_AI_MAX_TOKENS: 这是上限而非实际消耗, 非推理模型仍只输出几个 token
      max_tokens: MODERATION_AI_MAX_TOKENS
    })
  })
  if (!res.ok) {
    throw new Error(`Moderation AI request failed with status ${res.status}`)
  }
  if (!res.body) {
    throw new Error('Moderation AI response has no body stream')
  }

  // 累积 OpenAI 兼容的流式增量, 等价于非流式的 choices[0].message.content 拼接;
  // 部分 chunk 可能只有 role delta 或空 choices; 非 data 行 (心跳注释、event 字段、
  // 空行) 与无法 JSON.parse 的 data 行 (纯文本 keep-alive) 均跳过
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let finishReason: string | null = null
  let modelName = model
  let tokensIn = 0
  let tokensOut = 0
  let done = false

  const handleDataLine = (line: string) => {
    const payload = line.slice(5).trim()
    if (payload === '[DONE]') {
      done = true
      return
    }
    let chunk: unknown
    try {
      chunk = JSON.parse(payload)
    } catch {
      // 纯文本 keep-alive、或被心跳截断的前缀 (续段会以新 data 行续传,
      // 截断只丢前缀不构成审核结论损失时由正文为空检查兜底)
      return
    }
    if (!chunk || typeof chunk !== 'object') {
      return
    }
    const c = chunk as {
      model?: unknown
      choices?: Array<{
        delta?: { content?: unknown }
        finish_reason?: unknown
      }>
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown }
    }
    if (typeof c.model === 'string') {
      modelName = c.model
    }
    const choice = c.choices?.[0]
    if (typeof choice?.delta?.content === 'string') {
      content += choice.delta.content
    }
    if (typeof choice?.finish_reason === 'string') {
      finishReason = choice.finish_reason
    }
    tokensIn = Number(c.usage?.prompt_tokens) || tokensIn
    tokensOut = Number(c.usage?.completion_tokens) || tokensOut
  }

  // 用 reader 而非 for-await: 项目 TS lib 未给 ReadableStream 暴露 asyncIterator
  const reader = res.body.getReader()
  while (true) {
    const { done: readerDone, value } = await reader.read()
    if (readerDone) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    // 只解析 data 行; 心跳注释/字段行/空行都跳过. 网络截断的 data 行会
    // 留在 buffer 直到 '\n' 到达续传, 天然完成重组
    for (const line of lines) {
      if (line.startsWith('data:')) {
        handleDataLine(line)
      }
    }
  }
  buffer += decoder.decode()
  if (buffer.startsWith('data:')) {
    handleDataLine(buffer)
  }

  if (!done) {
    throw new Error('Moderation AI stream ended without [DONE]')
  }
  if (!content.trim()) {
    throw new Error(
      `AI 返回正文为空 (finish_reason: ${finishReason ?? 'unknown'}), ` +
        `若为 length 通常是推理模型的思考耗尽了 max_tokens (${MODERATION_AI_MAX_TOKENS})`
    )
  }

  return {
    verdict: parseModerationVerdict(content),
    model: modelName,
    tokensIn,
    tokensOut
  }
}

export const moderateText = async (
  contentType: Exclude<ModerationContentType, 'avatar'>,
  text: string
) => {
  const model = process.env.MODERATION_AI_TEXT_MODEL
  if (!model) {
    throw new ModerationConfigError(
      'MODERATION_AI_TEXT_MODEL is not configured'
    )
  }
  return requestChatCompletion(model, [
    { role: 'system', content: MODERATION_TEXT_SYSTEM_PROMPT[contentType] },
    { role: 'user', content: `<content>${text}</content>` }
  ])
}

export const moderateImage = async (jpegBase64: string) => {
  const model = process.env.MODERATION_AI_VISION_MODEL
  if (!model) {
    throw new ModerationConfigError(
      'MODERATION_AI_VISION_MODEL is not configured'
    )
  }
  return requestChatCompletion(model, [
    { role: 'system', content: MODERATION_AVATAR_SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: '请审核这张用户头像' },
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${jpegBase64}` }
        }
      ]
    }
  ])
}
