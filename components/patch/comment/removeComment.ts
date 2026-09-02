import type { PatchComment } from '~/types/api/patch'

// 客户端评论树只有根与回复两层: get.ts 把根的全部后代摊平进 reply 且 parentId 统一为根 id,
// 删回复必须进父评论的 reply 数组里找, 顶层 filter 对回复是空操作。
// 服务端按 parent_id 级联删除整棵子树, 本地按 replyToId 求闭包同步剔除其子回复;
// 缓存里升级前写入的旧页面缺 replyToId, 此时退化为只剔除自身
export const removeComment = (prev: PatchComment[], commentId: number) => {
  if (prev.some((comment) => comment.id === commentId)) {
    return prev.filter((comment) => comment.id !== commentId)
  }

  return prev.map((comment) => {
    if (!comment.reply.some((reply) => reply.id === commentId)) {
      return comment
    }

    const removed = new Set([commentId])
    let grew = true
    while (grew) {
      grew = false
      for (const reply of comment.reply) {
        if (
          !removed.has(reply.id) &&
          reply.replyToId != null &&
          removed.has(reply.replyToId)
        ) {
          removed.add(reply.id)
          grew = true
        }
      }
    }
    return {
      ...comment,
      reply: comment.reply.filter((reply) => !removed.has(reply.id))
    }
  })
}
