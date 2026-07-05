'use client'

import { Chip } from '@heroui/react'
import { KunTimeAgo } from '~/components/kun/TimeAgo'
import { APPLICANT_STATUS_MAP } from '~/constants/admin'
import { ActionButton } from './ActionButton'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import type { AdminCreator } from '~/types/api/admin'

interface RenderCellProps {
  creator: AdminCreator
  columnKey: string
  onUpdate: () => void
}

const getStatusColor = (status: number) => {
  switch (status) {
    case 2:
      return 'success'
    case 3:
      return 'danger'
    default:
      return 'warning'
  }
}

export const RenderCell = ({
  creator,
  columnKey,
  onUpdate
}: RenderCellProps) => {
  switch (columnKey) {
    case 'sender':
      return (
        <>
          {creator.sender && (
            <KunUser
              user={creator.sender}
              userProps={{
                name: creator.sender.name,
                description: `已发布 ${creator.patchResourceCount} 个资源`,
                avatarProps: {
                  src: creator.sender?.avatar
                }
              }}
            />
          )}
        </>
      )
    case 'status':
      return (
        <Chip color={getStatusColor(creator.status)} variant="flat" size="sm">
          {APPLICANT_STATUS_MAP[creator.status]}
        </Chip>
      )
    case 'created':
      return <KunTimeAgo date={creator.created} />
    case 'actions':
      return creator.status === 0 ? (
        <ActionButton creator={creator} onUpdate={onUpdate} />
      ) : (
        <Chip variant="flat" color="success">
          已处理
        </Chip>
      )
    default:
      return null
  }
}
