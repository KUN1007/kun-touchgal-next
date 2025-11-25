'use client'

import { Chip } from '@heroui/react'
import Link from 'next/link'
import { SUPPORTED_RESOURCE_LINK_MAP } from '~/constants/resource'
import { formatTimeDifference } from '~/utils/time'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import { ResourceApprovalButton } from './ApprovalButton'
import { RESOURCE_STATUS_MAP } from '~/constants/admin'
import type { AdminResource } from '~/types/api/admin'

const getStatusColor = (status: number) => {
  switch (status) {
    case 0:
      return 'success'
    case 1:
      return 'danger'
    case 2:
      return 'warning'
    default:
      return 'default'
  }
}

export const RenderCell = (resource: AdminResource, columnKey: string) => {
  switch (columnKey) {
    case 'name':
      return (
        <Link
          href={`/${resource.uniqueId}`}
          className="font-medium hover:text-primary-500"
        >
          {resource.patchName}
        </Link>
      )
    case 'user':
      return (
        <KunUser
          user={resource.user}
          userProps={{
            name: resource.user.name,
            avatarProps: {
              src: resource.user.avatar
            }
          }}
        />
      )
    case 'storage':
      return (
        <Chip color="primary" variant="flat">
          {SUPPORTED_RESOURCE_LINK_MAP[resource.storage]}
        </Chip>
      )
    case 'size':
      return (
        <Chip size="sm" variant="flat">
          {resource.size}
        </Chip>
      )
    case 'status':
      return (
        <Chip size="sm" variant="flat" color={getStatusColor(resource.status)}>
          {RESOURCE_STATUS_MAP[resource.status] ?? '未知'}
        </Chip>
      )
    case 'created':
      return (
        <Chip size="sm" variant="light">
          {formatTimeDifference(resource.created)}
        </Chip>
      )
    case 'actions':
      return <ResourceApprovalButton resource={resource} />
    default:
      return (
        <Chip color="primary" variant="flat">
          未知
        </Chip>
      )
  }
}

