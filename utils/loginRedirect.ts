// 登录成功后跳回登录前页面。from 来自 URL 参数, 必须限制为站内相对路径,
// 防止 ?from=//evil.com 之类的开放重定向; 认证流程自身页面回跳会造成死循环, 一并排除
const isSafeRedirectPath = (path: string) =>
  path.startsWith('/') &&
  !path.startsWith('//') &&
  !path.startsWith('/\\') &&
  // WHATWG URL 解析会剥离整串中的 \t \n \r, "/\t/evil.com" 会被浏览器读成 "//evil.com"
  !/[\t\n\r]/.test(path) &&
  !path.startsWith('/login') &&
  !path.startsWith('/register') &&
  !path.startsWith('/auth')

export const resolveKunLoginRedirect = (search: string) => {
  const from = new URLSearchParams(search).get('from')
  return from && isSafeRedirectPath(from) ? from : '/'
}
