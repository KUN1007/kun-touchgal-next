'use client'

import { Chip } from '@heroui/react'
import {
  USER_ROLE_MAP,
  USER_STATUS_COLOR_MAP,
  USER_STATUS_MAP
} from '~/constants/user'
import { UserEdit } from './UserEdit'
import { UserDelete } from './UserDelete'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import type { AdminUser as AdminUserType } from '~/types/api/admin'

export const RenderCell = (user: AdminUserType, columnKey: string) => {
  switch (columnKey) {
    case 'user':
      return (
        <KunUser
          user={user}
          userProps={{
            name: user.name,
            description: `补丁数 - ${user._count.patch} | 资源数 - ${user._count.patch_resource}`,
            avatarProps: {
              src: user.avatar
            }
          }}
        />
      )
    case 'role':
      return (
        <Chip color="primary" variant="flat">
          {USER_ROLE_MAP[user.role]}
        </Chip>
      )
    case 'status':
      return (
        <Chip color={USER_STATUS_COLOR_MAP[user.status]} variant="flat">
          {USER_STATUS_MAP[user.status]}
        </Chip>
      )
    case 'actions':
      return (
        <div className="flex items-center gap-2">
          <UserEdit initialUser={user} />
          <UserDelete user={user} />
        </div>
      )
    default:
      return null
  }
}
