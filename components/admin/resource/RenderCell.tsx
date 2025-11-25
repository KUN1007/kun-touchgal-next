'use client'

import { Chip } from '@heroui/react'
import { SUPPORTED_RESOURCE_LINK_MAP } from '~/constants/resource'
import { formatTimeDifference } from '~/utils/time'
import Link from 'next/link'
import { ResourceEdit } from './ResourceEdit'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import type { AdminResource } from '~/types/api/admin'

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
    case 'created':
      return (
        <Chip size="sm" variant="light">
          {formatTimeDifference(resource.created)}
        </Chip>
      )
    case 'actions':
      return <ResourceEdit initialResource={resource} />
    default:
      return (
        <Chip color="primary" variant="flat">
          咕咕咕
        </Chip>
      )
  }
}
