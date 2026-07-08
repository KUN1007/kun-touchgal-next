'use client'

import { Chip } from '@heroui/react'
import Link from 'next/link'
import { SUPPORTED_RESOURCE_LINK_MAP } from '~/constants/resource'
import { RESOURCE_STATUS_MAP } from '~/constants/admin'
import { KunTimeAgo } from '~/components/kun/TimeAgo'
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
      if (!resource.links.length) {
        return (
          <Chip color="default" variant="flat">
            无链接
          </Chip>
        )
      }
      return (
        <div className="flex flex-wrap gap-1">
          {resource.links.slice(0, 2).map((link) => (
            <Chip key={link.id} color="primary" variant="flat">
              {SUPPORTED_RESOURCE_LINK_MAP[link.storage]}
            </Chip>
          ))}
          {resource.links.length > 2 && (
            <Chip color="default" variant="flat">
              +{resource.links.length - 2}
            </Chip>
          )}
        </div>
      )
    case 'size':
      if (!resource.links.length) {
        return (
          <Chip size="sm" variant="flat">
            无链接
          </Chip>
        )
      }
      return (
        <div className="flex flex-wrap gap-1">
          {resource.links.slice(0, 2).map((link) => (
            <Chip key={link.id} size="sm" variant="flat">
              {link.size}
            </Chip>
          ))}
          {resource.links.length > 2 && (
            <Chip size="sm" variant="flat">
              +{resource.links.length - 2}
            </Chip>
          )}
        </div>
      )
    case 'created':
      return (
        <Chip size="sm" variant="light">
          <KunTimeAgo date={resource.created} />
        </Chip>
      )
    case 'status': {
      const color =
        resource.status === 0
          ? 'success'
          : resource.status === 1
            ? 'danger'
            : resource.status === 3
              ? 'warning'
              : 'default'
      return (
        <Chip color={color} variant="flat">
          {RESOURCE_STATUS_MAP[resource.status] ?? '未知'}
        </Chip>
      )
    }
    case 'actions':
      return <ResourceEdit initialResource={resource} />
    default:
      return (
        <Chip color="primary" variant="flat">
          未知
        </Chip>
      )
  }
}
