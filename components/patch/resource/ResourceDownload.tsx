'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@heroui/react'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import { Download } from 'lucide-react'
import { KunTimeAgo } from '~/components/kun/TimeAgo'
import { ResourceLikeButton } from './ResourceLike'
import { ResourceDownloadCard } from './DownloadCard'
import { getResourcePageTitle } from '~/utils/patch/getResourcePageTitle'
import type { PatchResource } from '~/types/api/patch'

interface Props {
  resource: PatchResource
}

// 资源备注不在卡片上展示, 点击资源名进入资源详情页查看简介与评论
export const ResourceDownload = ({ resource }: Props) => {
  const isPending = resource.status === 2 || resource.status === 3
  const [showLinks, setShowLinks] = useState<Record<number, boolean>>({})

  const toggleLinks = (resourceId: number) => {
    setShowLinks((prev) => ({
      ...prev,
      [resourceId]: !prev[resourceId]
    }))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col">
        <h3 className="font-medium">
          <Link
            href={`/${resource.uniqueId}/resource/${resource.id}`}
            className="transition-colors hover:text-primary"
          >
            {getResourcePageTitle(resource)}
          </Link>
        </h3>
        <p className="text-sm text-default-500">
          该资源创建于 <KunTimeAgo date={resource.created} />
        </p>
      </div>

      <div className="flex justify-between">
        <KunUser
          user={resource.user}
          userProps={{
            name: resource.user.name,
            description: (
              <>
                <KunTimeAgo date={resource.created} /> • 已发布资源{' '}
                {resource.user.patchCount} 个
              </>
            ),
            avatarProps: {
              showFallback: true,
              src: resource.user.avatar,
              name: resource.user.name.charAt(0).toUpperCase()
            }
          }}
        />

        <div className="flex gap-2">
          <ResourceLikeButton resource={resource} isDisabled={isPending} />
          <Button
            color="primary"
            isIconOnly
            aria-label={`下载 Galgame 资源`}
            isDisabled={isPending}
            onPress={() => toggleLinks(resource.id)}
          >
            <Download className="size-4" />
          </Button>
        </div>
      </div>

      {showLinks[resource.id] && (
        // data-kun-no-nav: 展开的下载区内点击 (含空白与文案) 不触发整卡导航
        <div className="space-y-3" data-kun-no-nav>
          {resource.links.map((link) => (
            <ResourceDownloadCard
              key={link.id}
              resource={resource}
              link={link}
            />
          ))}
        </div>
      )}
    </div>
  )
}
