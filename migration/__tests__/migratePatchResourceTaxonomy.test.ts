import { describe, expect, it } from 'vitest'
import {
  buildAiUserContent,
  decideResource,
  extractS3FileName,
  parseAiVerdict
} from '~/migration/migratePatchResourceTaxonomy'

describe('extractS3FileName', () => {
  it('取 URL 末段作为文件名 (含中文)', () => {
    expect(
      extractS3FileName(
        'https://cloud.touchgaloss.com/patch/9708/resource/190747d099ac5489ab852ffa559b8d0fb1881f8e79ec525a89aa5223d9a594b9/LILITH翻译补丁.7z'
      )
    ).toBe('LILITH翻译补丁.7z')
  })

  it('解码 percent-encoding 的文件名', () => {
    expect(
      extractS3FileName(
        'https://cloud.touchgaloss.com/patch/1/resource/abc123/%E8%A1%A5%E4%B8%81.zip'
      )
    ).toBe('补丁.zip')
  })

  it('旧格式以对象 hash 结尾时返回 null', () => {
    expect(
      extractS3FileName(
        'https://cloud.touchgaloss.com/patch/8534/resource/3c1f6c3ff83a0ac579d9b1ef743056aabbccddeeff00112233445566778899aa'
      )
    ).toBeNull()
  })

  it('非法 URL 返回 null', () => {
    expect(extractS3FileName('not a url')).toBeNull()
  })
})

describe('parseAiVerdict', () => {
  it('解析单类型判定', () => {
    expect(parseAiVerdict('{"t":["fix"]}')).toEqual({
      k: 'classified',
      t: ['fix']
    })
  })

  it('解析 ai 类型并保留模型名', () => {
    expect(parseAiVerdict('{"t":["ai"],"m":"GPT-4o-0513"}')).toEqual({
      k: 'classified',
      t: ['ai'],
      m: 'GPT-4o-0513'
    })
  })

  it('解析双类型判定并保持顺序', () => {
    expect(parseAiVerdict('{"t":["ai","crack"],"m":"SakuraLLM"}')).toEqual({
      k: 'classified',
      t: ['ai', 'crack'],
      m: 'SakuraLLM'
    })
  })

  it('解析 uncertain', () => {
    expect(parseAiVerdict('{"k":"uncertain"}')).toEqual({ k: 'uncertain' })
  })

  it('剥离代码围栏', () => {
    expect(parseAiVerdict('```json\n{"t":["save"]}\n```')).toEqual({
      k: 'classified',
      t: ['save']
    })
  })

  it('非 JSON 降级为 uncertain', () => {
    expect(parseAiVerdict('这是修正补丁')).toEqual({ k: 'uncertain' })
  })

  it('词表外类型降级为 uncertain', () => {
    expect(parseAiVerdict('{"t":["banana"]}')).toEqual({ k: 'uncertain' })
  })

  it('空 t 数组降级为 uncertain', () => {
    expect(parseAiVerdict('{"t":[]}')).toEqual({ k: 'uncertain' })
  })

  it('超过 2 个类型降级为 uncertain', () => {
    expect(parseAiVerdict('{"t":["ai","crack","fix"]}')).toEqual({
      k: 'uncertain'
    })
  })

  it('两个翻译类互斥, 降级为 uncertain', () => {
    expect(parseAiVerdict('{"t":["manual","machine"]}')).toEqual({
      k: 'uncertain'
    })
  })

  it('重复类型去重后保留', () => {
    expect(parseAiVerdict('{"t":["ai","ai"],"m":"X"}')).toEqual({
      k: 'classified',
      t: ['ai'],
      m: 'X'
    })
  })

  it('含 ai 缺 m 时兜底未知模型', () => {
    expect(parseAiVerdict('{"t":["ai"]}')).toEqual({
      k: 'classified',
      t: ['ai'],
      m: '未知模型'
    })
  })

  it('不含 ai 的多余 m 被丢弃', () => {
    expect(parseAiVerdict('{"t":["fix"],"m":"GPT-4o"}')).toEqual({
      k: 'classified',
      t: ['fix']
    })
  })
})

describe('decideResource', () => {
  it('type 已全部是新词表时判为 done', () => {
    expect(decideResource(['ai'], ['zh-Hans'], null)).toEqual({
      action: 'done'
    })
    expect(decideResource(['manual'], ['zh-Hans'], null)).toEqual({
      action: 'done'
    })
  })

  it('AI 调用失败时不迁移', () => {
    expect(decideResource(['chinese', 'patch'], ['zh-Hans'], null)).toEqual({
      action: 'skip',
      report: { bucket: 'ai-failed', reason: 'AI 判定调用失败' }
    })
  })

  it('uncertain 时不迁移', () => {
    expect(
      decideResource(['chinese', 'patch'], ['zh-Hans'], { k: 'uncertain' })
    ).toEqual({
      action: 'skip',
      report: { bucket: 'uncertain', reason: 'AI 无法确定补丁类型' }
    })
  })

  it('{chinese,patch} 判为 ai 时迁移并写 model_name', () => {
    expect(
      decideResource(['chinese', 'patch'], ['zh-Hans'], {
        k: 'classified',
        t: ['ai'],
        m: 'DeepSeek-V2.5'
      })
    ).toEqual({
      action: 'migrate',
      update: { type: ['ai'], model_name: 'DeepSeek-V2.5' },
      reports: []
    })
  })

  it('{patch} 判为 fix 时迁移且无复核项', () => {
    expect(
      decideResource(['patch'], ['ja'], { k: 'classified', t: ['fix'] })
    ).toEqual({
      action: 'migrate',
      update: { type: ['fix'] },
      reports: []
    })
  })

  it('{patch} 判为翻译类时记 cross-over', () => {
    const decision = decideResource(['patch'], ['zh-Hans'], {
      k: 'classified',
      t: ['ai'],
      m: 'Claude-3.5-Sonnet'
    })
    expect(decision.action).toBe('migrate')
    if (decision.action === 'migrate') {
      expect(decision.reports).toEqual([
        { bucket: 'cross-over', reason: '原组合不含 chinese 但判定为 ai' }
      ])
    }
  })

  it('{chinese,patch} 判为非翻译类时记 cross-over', () => {
    const decision = decideResource(['chinese', 'patch'], ['zh-Hans'], {
      k: 'classified',
      t: ['fix']
    })
    expect(decision.action).toBe('migrate')
    if (decision.action === 'migrate') {
      expect(decision.reports).toEqual([
        { bucket: 'cross-over', reason: '原组合含 chinese 但判定为 fix' }
      ])
    }
  })

  it('判为翻译类但 language 不含中文时记 language-mismatch', () => {
    const decision = decideResource(['chinese', 'patch'], ['ja'], {
      k: 'classified',
      t: ['ai'],
      m: '未知模型'
    })
    expect(decision.action).toBe('migrate')
    if (decision.action === 'migrate') {
      expect(decision.reports).toEqual([
        {
          bucket: 'language-mismatch',
          reason: '判定为翻译补丁但 language 为 {ja}, 本次不改 language'
        }
      ])
    }
  })

  it('双类型时记 second-type', () => {
    const decision = decideResource(['chinese', 'patch'], ['zh-Hans'], {
      k: 'classified',
      t: ['ai', 'crack'],
      m: 'GPT-4'
    })
    expect(decision.action).toBe('migrate')
    if (decision.action === 'migrate') {
      expect(decision.update).toEqual({
        type: ['ai', 'crack'],
        model_name: 'GPT-4'
      })
      expect(decision.reports).toEqual([
        { bucket: 'second-type', reason: '判定为多类型 {ai,crack}' }
      ])
    }
  })

  it('边角组合 {chinese} 判为 uncensored 时迁移并记 cross-over', () => {
    const decision = decideResource(['chinese'], ['zh-Hans'], {
      k: 'classified',
      t: ['uncensored']
    })
    expect(decision.action).toBe('migrate')
    if (decision.action === 'migrate') {
      expect(decision.update).toEqual({ type: ['uncensored'] })
      expect(decision.reports).toEqual([
        {
          bucket: 'cross-over',
          reason: '原组合含 chinese 但判定为 uncensored'
        }
      ])
    }
  })
})

describe('buildAiUserContent', () => {
  it('拼接标题/备注/原分类/文件名', () => {
    expect(
      buildAiUserContent('标题A', '备注B', ['patch', 'chinese'], ['a.7z'])
    ).toBe(
      '标题: 标题A\n备注: 备注B\n原分类: {chinese,patch}\n网盘文件名:\n- a.7z'
    )
  })

  it('空字段显示占位符', () => {
    expect(buildAiUserContent('', '', ['patch'], [])).toBe(
      '标题: (空)\n备注: (空)\n原分类: {patch}\n网盘文件名:\n(无)'
    )
  })

  it('备注截断到 500 字', () => {
    const longNote = 'x'.repeat(600)
    const content = buildAiUserContent('t', longNote, ['patch'], [])
    expect(content).toContain('x'.repeat(500))
    expect(content).not.toContain('x'.repeat(501))
  })
})
