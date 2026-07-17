'use client'

import { KunMentionUserList } from '~/components/kun/MentionUserList'
import { cn } from '~/utils/cn'

interface Props {
  isPending: boolean
  users: KunUser[]
  style: React.CSSProperties
  onSelect: (user: KunUser) => void
}

export const MentionListDropdown = ({
  isPending,
  users,
  style,
  onSelect
}: Props) => {
  return (
    <div
      style={style}
      // 阻止点击下拉时 textarea 失焦, 否则 blur 会先关闭下拉导致选择失效
      onMouseDown={(event) => event.preventDefault()}
      className={cn(
        'fixed z-50',
        'w-full px-1 py-2 shadow max-w-64 bg-background border-small rounded-small border-default-200 dark:border-default-100'
      )}
    >
      <KunMentionUserList
        isPending={isPending}
        users={users}
        onSelect={onSelect}
      />
    </div>
  )
}
