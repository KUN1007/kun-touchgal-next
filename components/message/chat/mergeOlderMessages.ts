import type { PrivateMessage } from '~/types/api/conversation'

// 历史分页是 offset 分页, 本地追加新消息 (或对方来消息) 后服务端头部增长,
// 下一页会重叠上一页尾部; 按 id 剔除已加载的行, 碰撞时以本地为准
export const mergeOlderMessages = (
  prev: PrivateMessage[],
  incoming: PrivateMessage[]
) => {
  const loaded = new Set(prev.map((msg) => msg.id))
  return incoming.filter((msg) => !loaded.has(msg.id))
}
