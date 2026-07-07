import { handleOidcCallback } from '~/lib/oidc/webToNode'
import type { NextRequest } from 'next/server'

// oidc-provider 依赖 Node.js API（Koa/http），必须跑在 Node runtime，不能进 Edge。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handler = (req: NextRequest) => handleOidcCallback(req)

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
export const HEAD = handler
export const OPTIONS = handler
