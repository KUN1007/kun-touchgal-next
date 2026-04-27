export const kunCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV !== 'development',
  maxAge: maxAgeSeconds
})
