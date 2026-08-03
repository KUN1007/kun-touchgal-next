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

  it('reason 超出上限时截断, 裁决本身照常保留', () => {
    const raw = `{"pass":false,"code":"AD","reason":"${'长'.repeat(300)}"}`
    expect(parseModerationVerdict(raw)).toEqual({
      pass: false,
      code: 'AD',
      reason: '长'.repeat(200)
    })
  })

  it('截断按码点切, 不把代理对劈成孤立代理 (jsonb 会拒收)', () => {
    const raw = `{"pass":false,"code":"AD","reason":"${'长'.repeat(199)}😀尾"}`
    const verdict = parseModerationVerdict(raw)
    expect(verdict.reason).toBe(`${'长'.repeat(199)}😀`)
    // 真实失败点是 Prisma 序列化后交给 Postgres, 故直接断言序列化产物
    expect(JSON.stringify(verdict)).not.toContain('\\ud')
  })

  it('多重类别码保留, 管理端按原串展示', () => {
    expect(
      parseModerationVerdict('{"pass":false,"code":"POL,SEX,ILL"}')
    ).toEqual({ pass: false, code: 'POL,SEX,ILL' })
  })

  it('code 退化成说明句时丢弃该字段, 不拖垮 pass 判定', () => {
    expect(
      parseModerationVerdict(
        '{"pass":false,"code":"AD 该内容包含广告引流与诈骗信息","reason":"引流"}'
      )
    ).toEqual({ pass: false, code: undefined, reason: '引流' })
  })

  it('缺失 pass 仍抛错: 放宽的是附注, 裁决本身不可缺', () => {
    expect(() => parseModerationVerdict('{"code":"AD"}')).toThrow(
      /Invalid moderation/
    )
  })
})
