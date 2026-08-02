import { describe, expect, it } from 'vitest'
import { parseModerationVerdict } from '~/server/moderation/ai'

describe('parseModerationVerdict', () => {
  it('解析 prompt 约定的 boolean 形态, 含 code 与 reason', () => {
    expect(
      parseModerationVerdict('{"pass":false,"code":"COL","reason":"系列合集"}')
    ).toEqual({ pass: false, code: 'COL', reason: '系列合集' })
  })

  it('容忍 0/1 形态, 归一为 boolean', () => {
    expect(
      parseModerationVerdict('```json\n{"pass":1,"manual":1}\n```')
    ).toEqual({ pass: true, manual: true })
  })

  it('reason 超出 schema 上限时抛错, 交由重试而非落库半截裁决', () => {
    const raw = `{"pass":false,"code":"AD","reason":"${'长'.repeat(101)}"}`
    expect(() => parseModerationVerdict(raw)).toThrow(/Invalid moderation/)
  })
})
