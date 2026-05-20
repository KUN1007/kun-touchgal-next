import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import { delKv, getKv, setKv } from '~/lib/redis'
import { prisma } from '~/prisma/index'

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

const verifyAndLoadUser = async (refreshToken: string) => {
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET!, {
      issuer: process.env.JWT_ISS!,
      audience: process.env.JWT_AUD!
    }) as KunGalgamePayload
    const redisToken = await getKv(`access:token:${payload.uid}`)

    if (!redisToken || redisToken !== refreshToken) {
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
      await delKv(`access:token:${payload.uid}`)
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
  await delKv(`access:token:${uid}`)
}
