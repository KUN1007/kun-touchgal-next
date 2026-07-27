import { describe, expect, it } from 'vitest'
import { kunCjkIndentClass } from '~/utils/kunCjkIndent'

describe('kunCjkIndentClass', () => {
  it('对全角开标点开头的标题返回负缩进类', () => {
    expect(kunCjkIndentClass('【汉化】某游戏')).toBe('-indent-[0.5em]')
    expect(kunCjkIndentClass('（全年龄）某游戏')).toBe('-indent-[0.5em]')
    expect(kunCjkIndentClass('《某游戏》')).toBe('-indent-[0.5em]')
    expect(kunCjkIndentClass('「引用」标题')).toBe('-indent-[0.5em]')
  })

  it('对普通开头的标题返回空串', () => {
    expect(kunCjkIndentClass('某游戏【汉化】')).toBe('')
    expect(kunCjkIndentClass('Sabbat of the Witch')).toBe('')
    expect(kunCjkIndentClass('')).toBe('')
  })

  it('半角括号与西文引号无字形内空白, 不缩进', () => {
    expect(kunCjkIndentClass('(fan disc) 某游戏')).toBe('')
    expect(kunCjkIndentClass('[patch] 某游戏')).toBe('')
    expect(kunCjkIndentClass('“quoted” title')).toBe('')
  })
})
