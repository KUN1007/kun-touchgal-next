import { ADMIN_LOG_CONTENT_LIMIT } from '~/constants/admin'

export const truncateLogContent = (content: string) => {
  if (content.length <= ADMIN_LOG_CONTENT_LIMIT) {
    return content
  }

  return `${content.slice(0, ADMIN_LOG_CONTENT_LIMIT - 15)}...(truncated)`
}
