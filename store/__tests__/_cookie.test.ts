import { afterEach, describe, expect, it, vi } from 'vitest'
import { cookieStorage } from '~/store/_cookie'

const storeKey = 'kun-patch-setting-store'

const readState = () => {
  const item = cookieStorage.getItem(storeKey)
  return JSON.parse(item as string)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cookieStorage.getItem', () => {
  // js-cookie 写出的编码形态 (逗号留在 %2C), 端到端可恢复的基线
  it('合法编码的数组值端到端可恢复', () => {
    vi.stubGlobal('document', {
      cookie: `${storeKey}|state|data|kunBlockedTagIds=[1%2C2]`
    })

    expect(readState().state.data.kunBlockedTagIds).toEqual([1, 2])
  })

  // 曾在此整体失守: getItem 抛 URIError 被 zustand persist 静默吞掉,
  // 整个 store 回落 initialState
  it('畸形转义的 cookie 只丢自身, 其余键照常恢复', () => {
    vi.stubGlobal('document', {
      cookie: `${storeKey}|state|data|kunNsfwEnable=all; ${storeKey}|state|data|kunBlockedTagIds=%2`
    })

    const state = readState()
    expect(state.state.data.kunNsfwEnable).toBe('all')
    expect(state.state.data.kunBlockedTagIds).toBeUndefined()
  })

  // setNestedKeys 里的 JSON.parse 与 decodeURIComponent 走同一条守卫
  it('JSON 非法的数组值同样只丢自身', () => {
    vi.stubGlobal('document', {
      cookie: `${storeKey}|state|data|kunBlockedTagIds=[oops]; ${storeKey}|state|data|kunNsfwEnable=sfw`
    })

    const state = readState()
    expect(state.state.data.kunNsfwEnable).toBe('sfw')
    expect(state.state.data.kunBlockedTagIds).toBeUndefined()
  })
})
