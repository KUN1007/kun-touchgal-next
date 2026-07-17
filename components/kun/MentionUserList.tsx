'use client'

import { Avatar, Listbox, ListboxItem, Skeleton } from '@heroui/react'

interface Props {
  isPending: boolean
  users: KunUser[]
  onSelect: (user: KunUser) => void
}

export const KunMentionUserList = ({ isPending, users, onSelect }: Props) => {
  if (isPending) {
    return (
      <div className="w-64 p-2 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="w-32 h-4" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <Listbox
      aria-label="User mentions"
      classNames={{
        base: 'max-w-xs',
        list: 'max-h-[300px] overflow-scroll scrollbar-hide !p-0 !m-0'
      }}
      items={users}
      selectionMode="single"
      variant="flat"
      onSelectionChange={(keys) => {
        const userId = Array.from(keys)[0]
        const selectedUser = users.find((user) => user.id === Number(userId))
        if (userId && selectedUser) {
          onSelect(selectedUser)
        }
      }}
      disabledKeys={['null']}
    >
      {users.length ? (
        (user) => (
          <ListboxItem key={user.id} textValue={user.name}>
            <div className="flex items-center gap-2">
              <Avatar
                alt={user.name}
                className="w-8 h-8 shrink-0"
                src={user.avatar}
              />
              <span className="text-sm">{user.name}</span>
            </div>
          </ListboxItem>
        )
      ) : (
        <ListboxItem
          key="null"
          textValue="null"
          classNames={{
            base: 'w-64',
            wrapper: 'w-full'
          }}
        >
          继续输入以自动查找用户
        </ListboxItem>
      )}
    </Listbox>
  )
}
