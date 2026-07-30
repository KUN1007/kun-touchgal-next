import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { cookies, headers } from 'next/headers'
import { OIDC_MOUNT_PATH } from '~/config/oidc'
import { getOidcCallback } from './provider'

export interface NodeBridge {
  req: IncomingMessage
  res: ServerResponse
  bodyBuffer: Buffer | null
  toResponse: () => Response
}

// 用 Web Request 的 method/url/headers/body 构造 provider.callback() 能消费的 Node req/res，
// 并把 res 写出的 status/headers/body 捕获后转回 Web Response。
const attachCapture = (req: IncomingMessage): NodeBridge => {
  const chunks: Buffer[] = []
  const res = new ServerResponse(req)
  const capture = res as unknown as {
    write: (chunk?: unknown, ...args: unknown[]) => boolean
    end: (chunk?: unknown, ...args: unknown[]) => ServerResponse
    finished: boolean
  }

  const pushChunk = (chunk: unknown) => {
    if (chunk && typeof chunk !== 'function') {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
    }
  }
  const runCallback = (args: unknown[]) => {
    const cb = args.find((arg) => typeof arg === 'function') as
      (() => void) | undefined
    cb?.()
  }

  capture.write = (chunk?: unknown, ...args: unknown[]) => {
    pushChunk(chunk)
    runCallback(args)
    return true
  }
  capture.end = (chunk?: unknown, ...args: unknown[]) => {
    pushChunk(chunk)
    capture.finished = true
    res.emit('finish')
    runCallback(args)
    return res
  }

  const toResponse = () => {
    const responseHeaders = new Headers()
    for (const [key, value] of Object.entries(res.getHeaders())) {
      if (value === undefined) {
        continue
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          responseHeaders.append(key, String(item))
        }
      } else {
        responseHeaders.set(key, String(value))
      }
    }
    const body = chunks.length ? new Uint8Array(Buffer.concat(chunks)) : null
    return new Response(body, {
      status: res.statusCode,
      headers: responseHeaders
    })
  }

  return { req, res, bodyBuffer: null, toResponse }
}

const makeReq = (
  method: string,
  url: string,
  originalUrl: string,
  headerEntries: [string, string][],
  remoteAddress: string
) => {
  const socket = new Socket()
  // Socket.remoteAddress 是只读 getter，用 defineProperty 在实例上遮蔽。
  Object.defineProperty(socket, 'remoteAddress', {
    value: remoteAddress,
    configurable: true
  })
  const req = new IncomingMessage(socket)
  req.method = method
  req.url = url
  // provider 用 originalUrl 减去路由后的 url 推出 mountPath，以便 discovery 端点带上 /oidc 前缀。
  ;(req as unknown as { originalUrl?: string }).originalUrl = originalUrl
  req.headers = Object.fromEntries(headerEntries)
  return req
}

// 从 Web Request 构造 bridge。stripMount=true 时剥离 /oidc 前缀，供 provider.callback() 相对路由。
// skipBody=true 用于 interaction 场景：provider.interactionDetails/Finished 不读 body，
// 且调用方可能已消费过 request body。
export const buildRequestBridge = async (
  request: Request,
  stripMount: boolean,
  options: { skipBody?: boolean } = {}
): Promise<NodeBridge> => {
  const url = new URL(request.url)
  let path = url.pathname
  if (stripMount && path.startsWith(OIDC_MOUNT_PATH)) {
    path = path.slice(OIDC_MOUNT_PATH.length) || '/'
  }

  const headerEntries = [...request.headers.entries()]
  const forwardedFor = request.headers.get('x-forwarded-for')
  const req = makeReq(
    request.method,
    path + url.search,
    url.pathname + url.search,
    headerEntries,
    forwardedFor?.split(',')[0]?.trim() || '127.0.0.1'
  )
  if (!req.headers.host) {
    req.headers.host = url.host
  }

  const bridge = attachCapture(req)
  const bodyless =
    options.skipBody || request.method === 'GET' || request.method === 'HEAD'
  bridge.bodyBuffer = bodyless ? null : Buffer.from(await request.arrayBuffer())
  return bridge
}

// 在 Server Component 中无 Request 对象，用 next/headers 构造只读 bridge，供 interactionDetails 使用。
export const buildHeadersBridge = async (
  pathname: string
): Promise<NodeBridge> => {
  const [headerStore, cookieStore] = await Promise.all([headers(), cookies()])
  const headerEntries = [...headerStore.entries()]
  if (!headerEntries.some(([key]) => key === 'cookie')) {
    headerEntries.push(['cookie', cookieStore.toString()])
  }
  const req = makeReq('GET', pathname, pathname, headerEntries, '127.0.0.1')
  const bridge = attachCapture(req)
  req.push(null)
  return bridge
}

// catch-all 路由入口：把 Web 请求交给 provider.callback()，等 res 结束后转回 Response。
export const handleOidcCallback = (request: Request): Promise<Response> =>
  new Promise((resolve, reject) => {
    buildRequestBridge(request, true)
      .then((bridge) => {
        const callback = getOidcCallback()
        bridge.res.once('finish', () => resolve(bridge.toResponse()))
        callback(bridge.req, bridge.res)
        if (bridge.bodyBuffer && bridge.bodyBuffer.length) {
          bridge.req.push(bridge.bodyBuffer)
        }
        bridge.req.push(null)
      })
      .catch(reject)
  })
