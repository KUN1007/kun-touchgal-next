import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import { delKv, getKv, setKv } from '~/lib/redis'

export interface KunGalgameStatelessPayload {
  require2FA: boolean
  id: number
}

export interface KunGalgamePayload {
  iss: string
  aud: string
  jti: string
  uid: number
  name: string
  role: number
}

export const generateKunToken = async (
  uid: number,
  name: string,
  role: number,
  expire: string
) => {
  const payload: KunGalgamePayload = {
    iss: process.env.JWT_ISS!,
    aud: process.env.JWT_AUD!,
    jti: randomUUID(),
    uid,
    name,
    role
  }

  const token = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: expire
  } as jwt.SignOptions)
  await setKv(`access:token:${payload.uid}`, token, 30 * 24 * 60 * 60)

  return token
}

export const generateKunStatelessToken = (
  payload: Record<string, string | number | boolean>,
  expire: number
) => {
  const token = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: expire
  })
  return token
}

export const verifyKunToken = async (refreshToken: string) => {
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET!, {
      issuer: process.env.JWT_ISS!,
      audience: process.env.JWT_AUD!
    }) as KunGalgamePayload
    const redisToken = await getKv(`access:token:${payload.uid}`)

    if (!redisToken || redisToken !== refreshToken) {
      return null
    }

    return payload
  } catch (error) {
    return null
  }
}

export const deleteKunToken = async (uid: number) => {
  await delKv(`access:token:${uid}`)
}
