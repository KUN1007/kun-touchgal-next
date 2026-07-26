import { prisma } from '~/prisma/index'
import type { Prisma } from '~/prisma/generated/prisma/client'
import type { CreateMessageType } from '~/types/api/message'

type MessageClient = Prisma.TransactionClient | typeof prisma

export const createMessage = async (
  data: CreateMessageType,
  db: MessageClient = prisma
) => {
  const message = await db.user_message.create({
    data
  })
  return message
}

export const createDedupMessage = async (
  data: CreateMessageType,
  db: MessageClient = prisma
) => {
  const duplicatedMessage = await db.user_message.findFirst({
    where: {
      ...data
    }
  })
  if (duplicatedMessage) {
    return
  }

  const message = createMessage(data, db)

  return message
}

// 以 (type, sender, recipient, link) 为去重键, 不含 content:
// 用于通知正文含可变内容 (如评论正文, 编辑后重审通过会变) 而
// 同一事件只应通知一次的场景; link 按评论 id 构造, 天然稳定
export const createLinkDedupMessage = async (
  data: CreateMessageType,
  db: MessageClient = prisma
) => {
  const duplicatedMessage = await db.user_message.findFirst({
    where: {
      type: data.type,
      sender_id: data.sender_id,
      recipient_id: data.recipient_id,
      link: data.link
    }
  })
  if (duplicatedMessage) {
    return
  }

  return createMessage(data, db)
}
