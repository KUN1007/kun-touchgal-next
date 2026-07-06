import { NextRequest, NextResponse } from 'next/server'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import { prisma } from '~/prisma/index'
import { bioSchema } from '~/validations/user'
import { invalidateUserSession } from '~/app/api/user/session/cache'
import {
  createModerationTask,
  hasPendingModeration,
  preScreenText
} from '~/server/moderation/submit'

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, bioSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }

  if (await hasPendingModeration('bio', { userId: payload.uid })) {
    return NextResponse.json('您提交的签名正在审核中, 暂时无法修改')
  }

  const moderation = await preScreenText(input.bio)

  if (moderation.intercept) {
    // 新签名暂存于任务 payload, 通过审核后由 apply.ts 写入 user 表
    await createModerationTask({
      contentType: 'bio',
      userId: payload.uid,
      payload: { text: input.bio, bio: input.bio },
      dryRun: false
    })
    await invalidateUserSession(payload.uid)

    // 响应形状与正常更新一致, 作者不感知审核的存在
    return NextResponse.json({})
  }

  await prisma.user.update({
    where: { id: payload.uid },
    data: { bio: input.bio }
  })

  if (moderation.queue) {
    await createModerationTask({
      contentType: 'bio',
      userId: payload.uid,
      payload: { text: input.bio, bio: input.bio },
      dryRun: true
    })
  }

  await invalidateUserSession(payload.uid)

  return NextResponse.json({})
}
