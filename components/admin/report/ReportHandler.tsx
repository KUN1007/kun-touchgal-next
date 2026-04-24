'use client'

import { Button } from '@heroui/button'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger
} from '@heroui/dropdown'
import { MoreVertical } from 'lucide-react'
import { useUserStore } from '~/store/userStore'
import type { AdminReport } from '~/types/api/admin'

interface Props {
  report: AdminReport
}

const buildPatchLink = (report: AdminReport) => {
  const uniqueId = report.patch.uniqueId
  if (!uniqueId) {
    return ''
  }
  const params = new URLSearchParams()
  if (report.targetType === 'comment' && report.comment) {
    params.set('target', 'comment')
    params.set('commentId', String(report.comment.id))
  } else if (report.targetType === 'rating' && report.rating) {
    params.set('tab', 'rating')
    params.set('target', 'rating')
    params.set('ratingId', String(report.rating.id))
  }
  if (report.reportedUser) {
    params.set('reportedUid', String(report.reportedUser.id))
  }
  const query = params.toString()
  return query ? `/${uniqueId}?${query}` : `/${uniqueId}`
}

export const ReportHandler = ({ report }: Props) => {
  const currentUser = useUserStore((state) => state.user)
  const patchLink = buildPatchLink(report)
  const userLink = report.reportedUser
    ? `/user/${report.reportedUser.id}/comment`
    : ''
  const disabledKeys = [
    ...(patchLink ? [] : ['game']),
    ...(userLink ? [] : ['user'])
  ]

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          isDisabled={currentUser.role < 3}
        >
          <MoreVertical size={16} />
        </Button>
      </DropdownTrigger>
      <DropdownMenu disabledKeys={disabledKeys}>
        <DropdownItem
          key="game"
          onPress={() => {
            if (patchLink) {
              window.open(patchLink, '_blank', 'noopener,noreferrer')
            }
          }}
        >
          前往游戏
        </DropdownItem>
        <DropdownItem
          key="user"
          onPress={() => {
            if (userLink) {
              window.open(userLink, '_blank', 'noopener,noreferrer')
            }
          }}
        >
          前往用户
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}
