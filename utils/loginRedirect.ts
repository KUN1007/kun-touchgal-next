// 认证流程自身页面: 回跳目标须排除 (死循环), 顶栏登录 href 须透传 (防自指覆盖 from)
const authPathPrefixes = ['/login', '/register', '/auth']

const isAuthPath = (path: string) =>
  authPathPrefixes.some((prefix) => path.startsWith(prefix))

// 登录成功后跳回登录前页面。from 来自 URL 参数, 必须限制为站内相对路径,
// 防止 ?from=//evil.com 之类的开放重定向
const isSafeRedirectPath = (path: string) =>
  path.startsWith('/') &&
  !path.startsWith('//') &&
  !path.startsWith('/\\') &&
  // WHATWG URL 解析会剥离整串中的 \t \n \r, "/\t/evil.com" 会被浏览器读成 "//evil.com"
  !/[\t\n\r]/.test(path) &&
  !isAuthPath(path)

export const resolveKunLoginRedirect = (search: string) => {
  const from = new URLSearchParams(search).get('from')
  return from && isSafeRedirectPath(from) ? from : '/'
}

// 顶栏登录入口的 href。认证流程页透传现有查询串 (保留既有 from, 避免自指覆盖),
// 其余页面把 pathname+search 一并放入 from, 与 middleware/auth.ts 的 redirectToLogin 对称。
// search 带或不带 '?' 前缀均可 (useSearchParams().toString() / window.location.search)
export const buildKunLoginHref = (pathname: string, search: string) => {
  const query = search.replace(/^\?/, '')
  if (isAuthPath(pathname)) {
    return query ? `/login?${query}` : '/login'
  }
  const from = query ? `${pathname}?${query}` : pathname
  return `/login?from=${encodeURIComponent(from)}`
}
