import { z } from 'zod'
import { prisma } from '~/prisma/index'
import {
  getConversationsSchema,
  createConversationSchema
} from '~/validations/conversation'
import { invalidateUserSession } from '~/app/api/user/session/cache'
import type { Conversation } from '~/types/api/conversation'

export const getConversations = async (
  input: z.infer<typeof getConversationsSchema>,
  uid: number
) => {
  const { page, limit } = input
  const offset = (page - 1) * limit

  const [data, total] = await Promise.all([
    prisma.user_conversation.findMany({
      where: {
        OR: [{ user_a_id: uid }, { user_b_id: uid }]
      },
      include: {
        user_a: {
          select: { id: true, name: true, avatar: true }
        },
        user_b: {
          select: { id: true, name: true, avatar: true }
        },
        messages: {
          orderBy: [{ created: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { content: true }
        }
      },
      orderBy: [{ last_message_time: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: limit
    }),
    prisma.user_conversation.count({
      where: {
        OR: [{ user_a_id: uid }, { user_b_id: uid }]
      }
    })
  ])

  const conversations: Conversation[] = data.map((conv) => ({
    id: conv.id,
    otherUser: conv.user_a_id === uid ? conv.user_b : conv.user_a,
    lastMessage: conv.messages[0]?.content || '',
    lastMessageTime: conv.last_message_time,
    unreadCount:
      conv.user_a_id === uid
        ? conv.user_a_unread_count
        : conv.user_b_unread_count
  }))

  return { conversations, total }
}

const MOEMOEPOINT_REQUIRED = 20
const MOEMOEPOINT_COST = 10

export const checkConversation = async (
  input: z.infer<typeof createConversationSchema>,
  uid: number,
  role: number
) => {
  const { targetUserId } = input

  if (targetUserId === uid) {
    return { error: '不能和自己创建会话' }
  }

  const [currentUser, targetUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: uid },
      select: { moemoepoint: true }
    }),
    prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, allow_private_message: true }
    })
  ])

  if (!currentUser) {
    return { error: '用户不存在' }
  }
  if (!targetUser) {
    return { error: '目标用户不存在' }
  }

  const [userAId, userBId] =
    uid < targetUserId ? [uid, targetUserId] : [targetUserId, uid]

  const conversation = await prisma.user_conversation.findUnique({
    where: {
      user_a_id_user_b_id: { user_a_id: userAId, user_b_id: userBId }
    }
  })

  if (conversation) {
    return {
      exists: true,
      conversationId: conversation.id,
      needsPayment: false,
      targetUserName: targetUser.name
    }
  }

  if (!targetUser.allow_private_message) {
    return { error: '对方已关闭私信功能' }
  }

  const isPrivileged = role > 2
  const hasEnoughPoints = currentUser.moemoepoint >= MOEMOEPOINT_REQUIRED

  if (!isPrivileged && !hasEnoughPoints) {
    return {
      error: `萌萌点不足，发起私聊需要至少 ${MOEMOEPOINT_REQUIRED} 萌萌点`
    }
  }

  return {
    exists: false,
    needsPayment: !isPrivileged,
    cost: MOEMOEPOINT_COST,
    currentPoints: currentUser.moemoepoint,
    targetUserName: targetUser.name
  }
}

export const getOrCreateConversation = async (
  input: z.infer<typeof createConversationSchema>,
  uid: number,
  role: number
) => {
  const { targetUserId } = input

  if (targetUserId === uid) {
    return '不能和自己创建会话'
  }

  const [currentUser, targetUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: uid },
      select: { moemoepoint: true }
    }),
    prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, allow_private_message: true }
    })
  ])

  if (!currentUser) {
    return '用户不存在'
  }
  if (!targetUser) {
    return '目标用户不存在'
  }

  const [userAId, userBId] =
    uid < targetUserId ? [uid, targetUserId] : [targetUserId, uid]

  let conversation = await prisma.user_conversation.findUnique({
    where: {
      user_a_id_user_b_id: { user_a_id: userAId, user_b_id: userBId }
    }
  })

  const isNew = !conversation
  const isPrivileged = role > 2

  if (!conversation) {
    if (!targetUser.allow_private_message) {
      return '对方已关闭私信功能'
    }

    if (!isPrivileged) {
      if (currentUser.moemoepoint < MOEMOEPOINT_REQUIRED) {
        return `萌萌点不足，发起私聊需要至少 ${MOEMOEPOINT_REQUIRED} 萌萌点`
      }

      if (currentUser.moemoepoint < MOEMOEPOINT_COST) {
        return `萌萌点不足，开启新私聊需要消耗 ${MOEMOEPOINT_COST} 萌萌点`
      }

      conversation = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: uid },
          data: { moemoepoint: { decrement: MOEMOEPOINT_COST } }
        })

        return tx.user_conversation.create({
          data: { user_a_id: userAId, user_b_id: userBId }
        })
      })
      await invalidateUserSession(uid)
    } else {
      conversation = await prisma.user_conversation.create({
        data: { user_a_id: userAId, user_b_id: userBId }
      })
    }
  }

  return { conversationId: conversation.id, isNew }
}
