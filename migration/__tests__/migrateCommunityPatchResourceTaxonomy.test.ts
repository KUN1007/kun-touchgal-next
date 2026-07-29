import { describe, expect, it } from 'vitest'
import {
  aiKindFor,
  buildAiUserContent,
  decideResource,
  extractS3FileName,
  migratePlatform,
  needsAi,
  parseAiVerdict
} from '~/migration/migrateCommunityPatchResourceTaxonomy'

describe('aiKindFor', () => {
  it('原 type 含五个非补丁旧值之一时走 triage', () => {
    expect(aiKindFor(['tool'])).toBe('triage')
    expect(aiKindFor(['notice', 'other'])).toBe('triage')
    expect(aiKindFor(['patch', 'row'])).toBe('triage')
    expect(aiKindFor(['app', 'chinese', 'mobile'])).toBe('triage')
    expect(aiKindFor(['chinese', 'emulator', 'patch'])).toBe('triage')
  })

  it('其余组合走 patch, 不进删除判断', () => {
    expect(aiKindFor(['patch'])).toBe('patch')
    expect(aiKindFor(['chinese', 'patch'])).toBe('patch')
    expect(aiKindFor(['pc'])).toBe('patch')
    expect(aiKindFor(['other'])).toBe('patch')
    expect(aiKindFor(['chinese', 'mobile', 'pc'])).toBe('patch')
  })
})

describe('parseAiVerdict', () => {
  it('解析单类型判定', () => {
    expect(parseAiVerdict('patch', '{"t":["fix"]}')).toEqual({
      k: 'classified',
      t: ['fix']
    })
  })

  it('解析 ai 类型并保留模型名', () => {
    expect(parseAiVerdict('patch', '{"t":["ai"],"m":"GPT-4o-0513"}')).toEqual({
      k: 'classified',
      t: ['ai'],
      m: 'GPT-4o-0513'
    })
  })

  it('解析双类型判定并保持顺序', () => {
    expect(
      parseAiVerdict('patch', '{"t":["ai","crack"],"m":"SakuraLLM"}')
    ).toEqual({
      k: 'classified',
      t: ['ai', 'crack'],
      m: 'SakuraLLM'
    })
  })

  it('triage 解析五种删除代号', () => {
    for (const cause of ['tool', 'notice', 'row', 'app', 'emulator']) {
      expect(parseAiVerdict('triage', `{"k":"delete","c":"${cause}"}`)).toEqual(
        {
          k: 'delete',
          c: cause
        }
      )
    }
  })

  it('patch 类资源的删除输出一律拒收 (结构性护栏)', () => {
    expect(parseAiVerdict('patch', '{"k":"delete","c":"tool"}')).toEqual({
      k: 'uncertain'
    })
    expect(parseAiVerdict('patch', '{"k":"delete","c":"row"}')).toEqual({
      k: 'uncertain'
    })
  })

  it('triage 删除输出缺少 c 时降级为 uncertain', () => {
    expect(parseAiVerdict('triage', '{"k":"delete"}')).toEqual({
      k: 'uncertain'
    })
  })

  it('triage 删除输出的 c 越界时降级为 uncertain', () => {
    expect(parseAiVerdict('triage', '{"k":"delete","c":"game"}')).toEqual({
      k: 'uncertain'
    })
  })

  it('删除代号不得混进 t 数组', () => {
    expect(parseAiVerdict('triage', '{"t":["tool"]}')).toEqual({
      k: 'uncertain'
    })
    expect(parseAiVerdict('triage', '{"t":["row"]}')).toEqual({
      k: 'uncertain'
    })
  })

  it('解析 uncertain', () => {
    expect(parseAiVerdict('patch', '{"k":"uncertain"}')).toEqual({
      k: 'uncertain'
    })
  })

  it('剥离代码围栏', () => {
    expect(parseAiVerdict('patch', '```json\n{"t":["save"]}\n```')).toEqual({
      k: 'classified',
      t: ['save']
    })
  })

  it('非 JSON 降级为 uncertain', () => {
    expect(parseAiVerdict('patch', '这是修正补丁')).toEqual({ k: 'uncertain' })
  })

  it('两个翻译类互斥, 降级为 uncertain', () => {
    expect(parseAiVerdict('patch', '{"t":["manual","machine"]}')).toEqual({
      k: 'uncertain'
    })
  })

  it('含 ai 缺 m 时兜底未知模型', () => {
    expect(parseAiVerdict('patch', '{"t":["ai"]}')).toEqual({
      k: 'classified',
      t: ['ai'],
      m: '未知模型'
    })
  })

  it('不含 ai 的多余 m 被丢弃', () => {
    expect(parseAiVerdict('patch', '{"t":["fix"],"m":"GPT-4o"}')).toEqual({
      k: 'classified',
      t: ['fix']
    })
  })

  it('manual 带兜底标记时保留 f', () => {
    expect(parseAiVerdict('patch', '{"t":["manual"],"f":1}')).toEqual({
      k: 'classified',
      t: ['manual'],
      f: true
    })
  })

  it('无兜底标记的 manual 不带 f', () => {
    expect(parseAiVerdict('patch', '{"t":["manual"]}')).toEqual({
      k: 'classified',
      t: ['manual']
    })
  })

  it('非 manual 类型上的兜底标记被丢弃', () => {
    expect(parseAiVerdict('patch', '{"t":["fix"],"f":1}')).toEqual({
      k: 'classified',
      t: ['fix']
    })
  })
})

describe('migratePlatform', () => {
  it('android 改为 windows', () => {
    expect(migratePlatform(['android'])).toEqual(['windows'])
  })

  it('ios 改为 windows', () => {
    expect(migratePlatform(['ios'])).toEqual(['windows'])
  })

  it('映射后与既有 windows 去重', () => {
    expect(migratePlatform(['android', 'ios', 'windows'])).toEqual(['windows'])
  })

  it('保留其余平台值', () => {
    expect(migratePlatform(['android', 'linux'])).toEqual(['linux', 'windows'])
  })

  it('无旧值时返回 null 表示不改动', () => {
    expect(migratePlatform(['windows'])).toBeNull()
    expect(migratePlatform([])).toBeNull()
  })
})

describe('needsAi', () => {
  it('旧词表组合需要 AI', () => {
    expect(needsAi(['patch'])).toBe(true)
    expect(needsAi(['chinese', 'patch'])).toBe(true)
    expect(needsAi(['tool'])).toBe(true)
  })

  it('纯 other 新旧同名, 仍需 AI 细分', () => {
    expect(needsAi(['other'])).toBe(true)
  })

  it('新词表组合无需 AI', () => {
    expect(needsAi(['fix'])).toBe(false)
    expect(needsAi(['ai', 'crack'])).toBe(false)
  })
})

describe('decideResource', () => {
  it('type 已是新词表且 platform 无旧值时判为 done', () => {
    expect(decideResource(['fix'], ['windows'], '', null)).toEqual({
      action: 'done'
    })
  })

  it('已是 ai 类型且有型号时判为 done', () => {
    expect(decideResource(['ai'], ['windows'], 'GPT-4o', null)).toEqual({
      action: 'done'
    })
  })

  it('已是 ai 类型但型号为空时补未知模型', () => {
    expect(decideResource(['ai'], ['windows'], '', null)).toEqual({
      action: 'migrate',
      update: { type: ['ai'], model_name: '未知模型' },
      reports: [
        {
          bucket: 'unknown-model',
          reason: '已是 ai 类型但 model_name 为空, 补为未知模型'
        }
      ]
    })
  })

  it('type 已完成但 platform 含旧值时仅迁移 platform', () => {
    expect(decideResource(['fix'], ['android'], '', null)).toEqual({
      action: 'migrate',
      update: { type: ['fix'], platform: ['windows'] },
      reports: [
        {
          bucket: 'platform-migrated',
          reason: 'platform {android} 含旧值, 改为 {windows}'
        }
      ]
    })
  })

  it('AI 调用失败时不迁移', () => {
    expect(decideResource(['chinese', 'patch'], ['windows'], '', null)).toEqual(
      {
        action: 'skip',
        report: { bucket: 'ai-failed', reason: 'AI 判定调用失败' }
      }
    )
  })

  it('triage 资源被确认为非补丁时删除', () => {
    expect(
      decideResource(['tool'], ['windows'], '', { k: 'delete', c: 'tool' })
    ).toEqual({ action: 'delete', cause: 'tool' })
    expect(
      decideResource(['patch', 'row'], ['windows'], '', {
        k: 'delete',
        c: 'row'
      })
    ).toEqual({ action: 'delete', cause: 'row' })
  })

  it('triage 资源被判为补丁时保留并记 triage-kept', () => {
    const decision = decideResource(
      ['chinese', 'patch', 'emulator'],
      ['windows'],
      '',
      {
        k: 'classified',
        t: ['manual']
      }
    )
    expect(decision.action).toBe('migrate')
    if (decision.action === 'migrate') {
      expect(decision.update).toEqual({ type: ['manual'] })
      expect(decision.reports).toEqual([
        {
          bucket: 'triage-kept',
          reason: '原分类含 {emulator} 但 AI 判定为补丁资源, 保留'
        }
      ])
    }
  })

  it('uncertain 时按规则填其他并迁移', () => {
    expect(
      decideResource(['chinese', 'patch'], ['windows'], '', { k: 'uncertain' })
    ).toEqual({
      action: 'migrate',
      update: { type: ['other'] },
      reports: [
        {
          bucket: 'uncertain-other',
          reason: 'AI 无法确定补丁类型, 按规则填其他'
        }
      ]
    })
  })

  it('triage 资源 uncertain 时保留并同时记两个桶', () => {
    const decision = decideResource(['tool'], ['windows'], '', {
      k: 'uncertain'
    })
    expect(decision.action).toBe('migrate')
    if (decision.action === 'migrate') {
      expect(decision.update).toEqual({ type: ['other'] })
      expect(decision.reports.map((r) => r.bucket)).toEqual([
        'uncertain-other',
        'triage-kept'
      ])
    }
  })

  it('uncertain 时一并迁移 platform 旧值', () => {
    const decision = decideResource(['patch'], ['android'], '', {
      k: 'uncertain'
    })
    expect(decision).toEqual({
      action: 'migrate',
      update: { type: ['other'], platform: ['windows'] },
      reports: [
        {
          bucket: 'uncertain-other',
          reason: 'AI 无法确定补丁类型, 按规则填其他'
        },
        {
          bucket: 'platform-migrated',
          reason: 'platform {android} 含旧值, 改为 {windows}'
        }
      ]
    })
  })

  it('判为 ai 时写入 model_name', () => {
    expect(
      decideResource(['chinese', 'patch'], ['windows'], '', {
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

  it('模型型号未知时记 unknown-model', () => {
    const decision = decideResource(['patch'], ['windows'], '', {
      k: 'classified',
      t: ['ai'],
      m: '未知模型'
    })
    expect(decision.action).toBe('migrate')
    if (decision.action === 'migrate') {
      expect(decision.reports).toEqual([
        {
          bucket: 'unknown-model',
          reason: 'AI 判为 ai 翻译补丁但无法提取模型型号'
        }
      ])
    }
  })

  it('未写明翻译方式的 manual 记 translation-fallback', () => {
    const decision = decideResource(['chinese', 'patch'], ['windows'], '', {
      k: 'classified',
      t: ['manual'],
      f: true
    })
    expect(decision.action).toBe('migrate')
    if (decision.action === 'migrate') {
      expect(decision.update).toEqual({ type: ['manual'] })
      expect(decision.reports).toEqual([
        {
          bucket: 'translation-fallback',
          reason: '未写明翻译方式, 按默认规则判为人工翻译补丁'
        }
      ])
    }
  })

  it('有据 manual 无复核项', () => {
    expect(
      decideResource(['chinese', 'patch'], ['windows'], '', {
        k: 'classified',
        t: ['manual']
      })
    ).toEqual({
      action: 'migrate',
      update: { type: ['manual'] },
      reports: []
    })
  })

  it('双类型时记 second-type', () => {
    const decision = decideResource(['chinese', 'patch'], ['windows'], '', {
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

  it('纯 other 组合经 AI 细分后写入新类型', () => {
    expect(
      decideResource(['other'], ['windows'], '', {
        k: 'classified',
        t: ['save']
      })
    ).toEqual({
      action: 'migrate',
      update: { type: ['save'] },
      reports: []
    })
  })
})

describe('extractS3FileName', () => {
  it('取 URL 末段作为文件名 (含中文)', () => {
    expect(
      extractS3FileName(
        'https://cloud.touchgaloss.com/patch/9708/resource/190747d099ac5489ab852ffa559b8d0fb1881f8e79ec525a89aa5223d9a594b9/LILITH翻译补丁.7z'
      )
    ).toBe('LILITH翻译补丁.7z')
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
