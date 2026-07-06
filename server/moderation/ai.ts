import { z } from 'zod'
import {
  MODERATION_AVATAR_SYSTEM_PROMPT,
  MODERATION_TEXT_SYSTEM_PROMPT
} from '~/constants/moderation'
import type { ModerationContentType } from '~/constants/moderation'

// configuration problems (missing env) should send the task to manual
// review instead of burning retries
export class ModerationConfigError extends Error {}

export const moderationVerdictSchema = z.object({
  p: z.union([z.literal(0), z.literal(1)]),
  c: z.string().max(10).optional(),
  r: z.string().max(100).optional(),
  m: z.union([z.literal(0), z.literal(1)]).optional()
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      // 推理模型的思考 (reasoning_content) 同样计入输出 token,
      // 上限太小会导致思考阶段耗尽 token, 正文 content 为空;
      // 这是上限而非实际消耗, 非推理模型仍只输出几个 token
      max_tokens: 2048
    })
  })
  if (!res.ok) {
    throw new Error(`Moderation AI request failed with status ${res.status}`)
  }

  const data = await res.json()
  const choice = data?.choices?.[0]
  const content = choice?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error(
      `AI 返回正文为空 (finish_reason: ${choice?.finish_reason ?? 'unknown'}), ` +
        '若为 length 通常是推理模型的思考耗尽了 max_tokens'
    )
  }

  return {
    verdict: parseModerationVerdict(content),
    model: typeof data?.model === 'string' ? data.model : model,
    tokensIn: Number(data?.usage?.prompt_tokens) || 0,
    tokensOut: Number(data?.usage?.completion_tokens) || 0
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
