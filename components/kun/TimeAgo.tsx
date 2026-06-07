'use client'

import { useMounted } from '~/hooks/useMounted'
import { formatDate, formatTimeDifference } from '~/utils/time'

interface KunTimeAgoProps {
  date: number | Date | string
}

export const KunTimeAgo = ({ date }: KunTimeAgoProps) => {
  // SSR 和客户端首次渲染使用固定时区的绝对时间，避免相对时间跨秒/分钟边界导致 hydration mismatch。
  const stableText = formatDate(date, { isShowYear: true, isPrecise: true })
  const isMounted = useMounted()

  return <>{isMounted ? formatTimeDifference(date) : stableText}</>
}
