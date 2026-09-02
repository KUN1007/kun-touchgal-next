import { describe, expect, it } from 'vitest'
import { mergePatchAlias } from '~/utils/mergePatchAlias'

describe('mergePatchAlias', () => {
  it('保留既有别名及其顺序, 新标题追加在后', () => {
    expect(
      mergePatchAlias(['手工别名', 'Bangumi 别名'], ['VNDB 标题'], '')
    ).toEqual(['手工别名', 'Bangumi 别名', 'VNDB 标题'])
  })

  it('既有别名为空时仅返回新标题', () => {
    expect(mergePatchAlias([], ['A', 'B'], '')).toEqual(['A', 'B'])
  })

  it('与既有别名重复的新标题去重, 新标题内部重复也去重', () => {
    expect(mergePatchAlias(['A', 'B'], ['B', 'C', 'C'], '')).toEqual([
      'A',
      'B',
      'C'
    ])
  })

  it('剔除与游戏名相同的项, 既有与新增两侧都剔除', () => {
    expect(mergePatchAlias(['游戏名', 'A'], ['游戏名', 'B'], '游戏名')).toEqual(
      ['A', 'B']
    )
  })
})
