import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  verifyHeaderCookieMock,
  getOidcProviderMock,
  buildHeadersBridgeMock,
  interactionDetailsMock,
  oidcClientFindUniqueMock,
  redirectMock
} = vi.hoisted(() => ({
  verifyHeaderCookieMock: vi.fn(),
  getOidcProviderMock: vi.fn(),
  buildHeadersBridgeMock: vi.fn(),
  interactionDetailsMock: vi.fn(),
  oidcClientFindUniqueMock: vi.fn(),
  redirectMock: vi.fn()
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))

vi.mock('~/prisma/index', () => ({
  prisma: { oidc_client: { findUnique: oidcClientFindUniqueMock } }
}))

vi.mock('~/lib/oidc/provider', () => ({
  getOidcProvider: getOidcProviderMock
}))

vi.mock('~/lib/oidc/webToNode', () => ({
  buildHeadersBridge: buildHeadersBridgeMock
}))

vi.mock('~/utils/actions/verifyHeaderCookie', () => ({
  verifyHeaderCookie: verifyHeaderCookieMock
}))

vi.mock('~/app/oidc/interaction/[uid]/ConsentCard', () => ({
  ConsentCard: vi.fn(() => null)
}))

import OidcInteractionPage from '~/app/oidc/interaction/[uid]/page'
import { ConfirmRedirect } from '~/app/oidc/interaction/[uid]/ConfirmRedirect'
import { ConsentCard } from '~/app/oidc/interaction/[uid]/ConsentCard'

interface RenderedElement {
  type: unknown
  props: Record<string, unknown>
}

const renderPage = async (uid = 'uid123') =>
  (await OidcInteractionPage({
    params: Promise.resolve({ uid })
  })) as unknown as RenderedElement

describe('OIDC interaction page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // 真实 next/navigation redirect 会抛出终止渲染，mock 保持同款语义，
    // 否则未登录分支会继续落入 ConfirmRedirect 造成假阴性
    redirectMock.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`)
    })
    getOidcProviderMock.mockReturnValue({
      interactionDetails: interactionDetailsMock
    })
    buildHeadersBridgeMock.mockResolvedValue({ req: {}, res: {} })
  })

  it('login 且已登录时渲染 ConfirmRedirect 硬跳转组件而非 redirect()', async () => {
    interactionDetailsMock.mockResolvedValue({
      prompt: { name: 'login' },
      params: { client_id: 'client-1', scope: 'openid profile' }
    })
    verifyHeaderCookieMock.mockResolvedValue({ uid: 7 })

    const element = await renderPage()

    expect(redirectMock).not.toHaveBeenCalled()
    expect(element.type).toBe(ConfirmRedirect)
    expect(element.props.confirmPath).toBe('/oidc/interaction/uid123/confirm')
  })

  it('login 且未登录时 redirect 到登录页并携带 from', async () => {
    interactionDetailsMock.mockResolvedValue({
      prompt: { name: 'login' },
      params: { client_id: 'client-1', scope: 'openid' }
    })
    verifyHeaderCookieMock.mockResolvedValue(null)

    await expect(renderPage()).rejects.toThrow(
      'NEXT_REDIRECT:/login?from=%2Foidc%2Finteraction%2Fuid123'
    )
  })

  it('consent 时渲染 ConsentCard', async () => {
    interactionDetailsMock.mockResolvedValue({
      prompt: { name: 'consent' },
      params: { client_id: 'client-1', scope: 'openid profile' }
    })
    oidcClientFindUniqueMock.mockResolvedValue({ client_name: '测试应用' })

    const element = await renderPage()

    expect(element.type).toBe(ConsentCard)
    expect(element.props).toMatchObject({
      clientName: '测试应用',
      scopes: ['openid', 'profile'],
      interactionPath: '/oidc/interaction/uid123'
    })
  })

  it('interaction 已失效时渲染友好提示而非抛错', async () => {
    interactionDetailsMock.mockRejectedValue(
      new Error('interaction session not found')
    )

    const element = await renderPage()

    expect(element.type).toBe('div')
  })
})
