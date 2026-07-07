import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getOidcProvider } from '~/lib/oidc/provider'
import { buildRequestBridge } from '~/lib/oidc/webToNode'
import { verifyHeaderCookie } from '~/utils/actions/verifyHeaderCookie'
import { OIDC_MOUNT_PATH } from '~/config/oidc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PromptMissing {
  missingOIDCScope?: string[]
  missingOIDCClaims?: string[]
  missingResourceScopes?: Record<string, string[]>
}

// 完成 login 交互：确认本站登录态后把 accountId 写入 provider session。
export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) => {
  const { uid } = await params
  const interactionPath = `${OIDC_MOUNT_PATH}/interaction/${uid}`
  const payload = await verifyHeaderCookie()
  if (!payload) {
    return NextResponse.redirect(
      new URL(
        `/login?callbackUrl=${encodeURIComponent(interactionPath)}`,
        req.url
      )
    )
  }

  const provider = getOidcProvider()
  const bridge = await buildRequestBridge(req, false, { skipBody: true })
  bridge.req.push(null)
  await provider.interactionFinished(bridge.req, bridge.res, {
    login: { accountId: String(payload.uid) }
  })
  return bridge.toResponse()
}

// 完成 consent 交互：构造 Grant 授予请求的 scope/claims，或按取消返回 access_denied。
export const POST = async (req: NextRequest) => {
  const provider = getOidcProvider()
  const denied = new URL(req.url).searchParams.get('error')

  const bridge = await buildRequestBridge(req, false, { skipBody: true })
  bridge.req.push(null)
  const details = await provider.interactionDetails(bridge.req, bridge.res)

  if (denied) {
    await provider.interactionFinished(bridge.req, bridge.res, {
      error: 'access_denied',
      error_description: '用户取消了授权'
    })
    return bridge.toResponse()
  }

  const accountId = details.session?.accountId
  if (!accountId) {
    return NextResponse.json('授权会话缺少登录态', { status: 401 })
  }

  const missing = details.prompt.details as PromptMissing
  let grant = details.grantId
    ? await provider.Grant.find(details.grantId)
    : undefined
  if (!grant) {
    grant = new provider.Grant({
      accountId,
      clientId: String(details.params.client_id ?? '')
    })
  }
  if (missing.missingOIDCScope) {
    grant.addOIDCScope(missing.missingOIDCScope.join(' '))
  }
  if (missing.missingOIDCClaims) {
    grant.addOIDCClaims(missing.missingOIDCClaims)
  }
  if (missing.missingResourceScopes) {
    for (const [indicator, scopes] of Object.entries(
      missing.missingResourceScopes
    )) {
      grant.addResourceScope(indicator, scopes.join(' '))
    }
  }
  const grantId = await grant.save()

  await provider.interactionFinished(
    bridge.req,
    bridge.res,
    { consent: { grantId } },
    { mergeWithLastSubmission: true }
  )
  return bridge.toResponse()
}
