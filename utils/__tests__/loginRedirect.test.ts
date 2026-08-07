import { describe, expect, it } from 'vitest'
import {
  buildKunLoginHref,
  resolveKunLoginRedirect
} from '~/utils/loginRedirect'

describe('resolveKunLoginRedirect', () => {
  it('返回合法的站内 from 路径', () => {
    expect(resolveKunLoginRedirect('?from=%2Fgalgame')).toBe('/galgame')
    expect(
      resolveKunLoginRedirect('?from=%2Fuser%2F1%2Fsetting%3Ftab%3Dsecurity')
    ).toBe('/user/1/setting?tab=security')
  })

  it('缺少 from 时回落首页', () => {
    expect(resolveKunLoginRedirect('')).toBe('/')
    expect(resolveKunLoginRedirect('?foo=bar')).toBe('/')
  })

  it('拒绝开放重定向载荷', () => {
    expect(resolveKunLoginRedirect('?from=https%3A%2F%2Fevil.com')).toBe('/')
    expect(resolveKunLoginRedirect('?from=%2F%2Fevil.com')).toBe('/')
    expect(resolveKunLoginRedirect('?from=%2F%5Cevil.com')).toBe('/')
    expect(resolveKunLoginRedirect('?from=evil.com')).toBe('/')
    // URL 解析器剥离 \t \n \r 后 "/\t/evil.com" 变为协议相对的 "//evil.com"
    expect(resolveKunLoginRedirect('?from=%2F%09%2Fevil.com')).toBe('/')
    expect(resolveKunLoginRedirect('?from=%2F%0A%2Fevil.com')).toBe('/')
    expect(resolveKunLoginRedirect('?from=%2F%0D%2Fevil.com')).toBe('/')
  })

  it('拒绝认证流程自身页面, 防止回跳循环', () => {
    expect(resolveKunLoginRedirect('?from=%2Flogin')).toBe('/')
    expect(resolveKunLoginRedirect('?from=%2Flogin%2F2fa')).toBe('/')
    expect(resolveKunLoginRedirect('?from=%2Fregister')).toBe('/')
    expect(resolveKunLoginRedirect('?from=%2Fauth%2Fforgot')).toBe('/')
  })

  it('放行 oidc 交互页, 保证 sso 登录后回到授权流程', () => {
    expect(resolveKunLoginRedirect('?from=%2Foidc%2Finteraction%2Fabc')).toBe(
      '/oidc/interaction/abc'
    )
  })
})

describe('buildKunLoginHref', () => {
  it('普通页把 pathname+search 放入 from', () => {
    expect(buildKunLoginHref('/galgame', 'page=3')).toBe(
      '/login?from=%2Fgalgame%3Fpage%3D3'
    )
    expect(buildKunLoginHref('/galgame', '')).toBe('/login?from=%2Fgalgame')
  })

  it('接受带 ? 前缀的 search', () => {
    expect(buildKunLoginHref('/galgame', '?page=3')).toBe(
      '/login?from=%2Fgalgame%3Fpage%3D3'
    )
  })

  it('认证页透传既有查询串, 不自指覆盖 from', () => {
    expect(buildKunLoginHref('/login', 'from=%2Fadmin')).toBe(
      '/login?from=%2Fadmin'
    )
    expect(buildKunLoginHref('/login/2fa', '?from=%2Fadmin')).toBe(
      '/login?from=%2Fadmin'
    )
  })

  it('认证页无查询串时返回裸 /login', () => {
    expect(buildKunLoginHref('/register', '')).toBe('/login')
    expect(buildKunLoginHref('/auth/forgot', '')).toBe('/login')
  })
})
