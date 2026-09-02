import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { KunRating, type RatingProps } from '~/components/kun/Rating'

const render = (props: RatingProps) =>
  renderToString(createElement(KunRating, props))

const countFilled = (html: string) =>
  (html.match(/fill="currentColor"/g) ?? []).length

describe('KunRating 首屏渲染', () => {
  it('受控 value 在首次(服务端)渲染即生效, 不依赖 effect 同步', () => {
    const html = render({ readOnly: true, valueMax: 10, value: 7 })
    expect(html).toContain('aria-valuenow="7"')
    // 7/10 * 5 = 3.5 星: 3 颗整星 + 半星的填充层
    expect(countFilled(html)).toBe(4)
    expect(html.match(/clip-path/g)).toHaveLength(1)
  })

  it('非受控 defaultValue 仍走内部状态', () => {
    const html = render({ defaultValue: 4 })
    expect(html).toContain('aria-valuenow="4"')
    expect(countFilled(html)).toBe(4)
  })
})
