'use client'

import { differenceInDays } from 'date-fns'
import { useMounted } from '~/hooks/useMounted'
import { formatDate, formatTimeDifference } from '~/utils/time'

interface KunTimeAgoProps {
  date: number | Date | string
  // 超过该天数后不再显示相对时间，改为直接显示日期
  maxRelativeDays?: number
}

export const KunTimeAgo = ({ date, maxRelativeDays }: KunTimeAgoProps) => {
  // SSR 和客户端首次渲染使用固定时区的绝对时间，避免相对时间跨秒/分钟边界导致 hydration mismatch。
  const stableText = formatDate(date, { isShowYear: true, isPrecise: true })
  const isMounted = useMounted()

  if (!isMounted) {
    return <>{stableText}</>
  }

  const isBeyondRelativeRange =
    maxRelativeDays !== undefined &&
    differenceInDays(new Date(), new Date(date)) > maxRelativeDays

  return (
    <>
      {isBeyondRelativeRange
        ? formatDate(date, { isShowYear: true })
        : formatTimeDifference(date)}
    </>
  )
}
