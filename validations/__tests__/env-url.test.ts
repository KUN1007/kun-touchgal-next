import { describe, expect, it } from 'vitest'
import { kunWebUrlSchema } from '~/validations/env-url'

describe('kunWebUrlSchema 拒绝 scheme-less / 空 host 值', () => {
  // z.string().url() 会放过这些 opaque-scheme 值 (如 'localhost:' 被当作协议名),
  // 且 new URL(v).host 为空串, 导致 CSRF 白名单被静默空置
  it.each([
    'localhost:3000',
    'www.moyu.moe:443',
    'mailto:a@b.co',
    'www.moyu.moe',
    'https://',
    'http://:3000'
  ])('拒绝 %s', (value) => {
    expect(kunWebUrlSchema.safeParse(value).success).toBe(false)
  })

  it.each([
    'https://www.moyu.moe',
    'https://www.moyu.moe:443',
    'http://127.0.0.1:3000',
    'HTTPS://www.moyu.moe'
  ])('放行 %s', (value) => {
    expect(kunWebUrlSchema.safeParse(value).success).toBe(true)
  })
})
