import { jwtVerify } from 'jose'
import type { KunGalgamePayload } from './jwt'

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET!)

export const verifyKunTokenEdge = async (token: string) => {
  if (!token) {
    return null
  }
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: process.env.JWT_ISS!,
      audience: process.env.JWT_AUD!,
      algorithms: ['HS256']
    })
    return payload as unknown as KunGalgamePayload
  } catch {
    return null
  }
}
