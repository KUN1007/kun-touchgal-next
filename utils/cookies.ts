// 畸形百分号序列会让 decodeURIComponent 抛 URIError。proxy 里抛一次就是
// /admin /user /edit 的 500, 而失败的 middleware 同时挡住了能清掉坏 cookie 的
// 页面, 用户无法自救; 回落原值让同一 header 里其余 cookie 照常可读
const decodeCookieValue = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// 必须与 next/headers 的 cookies() 和 store/_cookie.ts 保持同一套解码:
// js-cookie 写入时不解回 %2C, decodeURI 也不解, 会让含逗号的 JSON 值解析失败
export const parseCookies = (cookieString: string) => {
  const cookiesKv: { [key: string]: string } = {}
  cookieString &&
    cookieString.split(';').forEach((cookie) => {
      const parts: string[] = cookie.split('=')
      if (parts.length) {
        cookiesKv[parts.shift()!.trim()] = decodeCookieValue(parts.join('='))
      }
    })
  return cookiesKv
}
