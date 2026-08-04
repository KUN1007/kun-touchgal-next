// 必须与 next/headers 的 cookies() 和 store/_cookie.ts 保持同一套解码:
// js-cookie 写入时不解回 %2C, decodeURI 也不解, 会让含逗号的 JSON 值解析失败
export const parseCookies = (cookieString: string) => {
  const cookiesKv: { [key: string]: string } = {}
  cookieString &&
    cookieString.split(';').forEach((cookie) => {
      const parts: string[] = cookie.split('=')
      if (parts.length) {
        cookiesKv[parts.shift()!.trim()] = decodeURIComponent(parts.join('='))
      }
    })
  return cookiesKv
}
