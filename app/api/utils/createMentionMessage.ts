import { prisma } from '~/prisma/index'
import { markdownToText } from '~/utils/markdownToText'
import { buildCommentLink } from '~/utils/patch/buildCommentLink'
import type { CreateMessageType } from '~/types/api/message'

export const extractMentionUserIds = (text: string) => {
  // 编辑器插入的提及链接指向 /user/{id}/comment, 历史内容存在 /resource 变体
  const regex = /\[@[^\]]+\]\(\/user\/(\d+)\/(?:comment|resource)\)/g
  return [...text.matchAll(regex)].map((match) => Number(match[1]))
}

export const createMentionMessage = async (
  uniqueId: string,
  patchName: string,
  commentId: number,
  senderUid: number,
  senderUsername: string,
  text: string,
  resourceId: number | null = null
) => {
  const mentionedUserIds = extractMentionUserIds(text)
  if (mentionedUserIds.length) {
    const mentionMessageData: CreateMessageType[] = mentionedUserIds.map(
      (mentionUid) => {
        return {
          type: 'mention',
          content: `${senderUsername} 在「${patchName}」的评论区提到了您\n${markdownToText(text).slice(0, 50)}`,
          sender_id: senderUid,
          recipient_id: mentionUid,
          link: buildCommentLink(uniqueId, commentId, resourceId)
        }
      }
    )
    await prisma.user_message.createMany({
      data: mentionMessageData,
      skipDuplicates: true
    })
  }
}
