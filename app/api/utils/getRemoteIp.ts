export const getRemoteIp = (headers: Headers): string => {
  const ipForwarded = () => {
    const ip = headers.get('x-forwarded-for')
    if (Array.isArray(ip)) {
      return ip[0]
    } else {
      return ip?.split(',')[0]?.trim() ?? ''
    }
  }

  const xRealIp = headers.get('x-real-ip')
  const cfConnectingIp = headers.get('CF-Connecting-IP')

  return cfConnectingIp || ipForwarded() || xRealIp || ''
}
