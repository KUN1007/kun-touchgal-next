import { prisma } from '~/prisma/index'
import type { AccountClaims, FindAccount } from 'oidc-provider'

// 把本站 user（Int 主键）映射为 OIDC account，sub 用字符串化的用户 id。
export const findAccount: FindAccount = async (_ctx, id) => {
  const uid = Number(id)
  if (!Number.isInteger(uid)) {
    return undefined
  }

  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      bio: true,
      status: true
    }
  })
  // status === 2 为封禁用户，与登录/JWT 校验一致，拒绝签发任何 OIDC 身份。
  if (!user || user.status === 2) {
    return undefined
  }

  return {
    accountId: id,
    async claims(_use, scope) {
      const scopes = new Set(scope.split(' '))
      const result: AccountClaims = { sub: id }
      if (scopes.has('profile')) {
        result.name = user.name
        result.picture = user.avatar || undefined
        result.profile = user.bio || undefined
      }
      if (scopes.has('email')) {
        result.email = user.email
        result.email_verified = true
      }
      return result
    }
  }
}
