import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import { delKv, getKv, setKv } from '~/lib/redis'
import { prisma } from '~/prisma/index'
import { invalidateUserSession } from '~/app/api/user/session/cache'

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
  await Promise.all([
    setKv(`access:token:${payload.uid}`, token, 30 * 24 * 60 * 60),
    invalidateUserSession(payload.uid)
  ])

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

export const verifyKunTokenPayload = async (refreshToken: string) => {
  if (!refreshToken) {
    return null
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET!, {
      issuer: process.env.JWT_ISS!,
      audience: process.env.JWT_AUD!
    }) as KunGalgamePayload
    const redisToken = await getKv(`access:token:${payload.uid}`)

    return redisToken === refreshToken ? payload : null
  } catch (error) {
    return null
  }
}

const verifyAndLoadUser = async (refreshToken: string) => {
  try {
    const payload = await verifyKunTokenPayload(refreshToken)

    if (!payload) {
      return null
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.uid },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
        blocked_tag_ids: true
      }
    })
    if (!user || user.status === 2) {
      await deleteKunToken(payload.uid)
      return null
    }

    return {
      payload: { ...payload, name: user.name, role: user.role },
      user
    }
  } catch (error) {
    return null
  }
}

export const verifyKunToken = async (refreshToken: string) => {
  return (await verifyAndLoadUser(refreshToken))?.payload ?? null
}

export const verifyKunTokenWithUser = async (refreshToken: string) => {
  return verifyAndLoadUser(refreshToken)
}

export const deleteKunToken = async (uid: number) => {
  await Promise.all([delKv(`access:token:${uid}`), invalidateUserSession(uid)])
}
