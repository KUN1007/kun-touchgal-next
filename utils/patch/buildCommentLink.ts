// 评论通知的 link 既是跳转目标, 也是删除评论 / 取消点赞时
// user_message.deleteMany 精确匹配的清理键——构造与清理必须同源, 一律走本函数
export const buildCommentLink = (
  uniqueId: string,
  commentId: number,
  resourceId: number | null
) =>
  resourceId
    ? `/${uniqueId}/resource/${resourceId}?commentId=${commentId}`
    : `/${uniqueId}?tab=comments&commentId=${commentId}`
