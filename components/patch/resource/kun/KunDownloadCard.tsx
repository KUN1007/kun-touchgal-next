'use client'

import { Chip } from '@heroui/chip'
import { Link } from '@heroui/link'
import { Cloud, Database, Link as LinkIcon } from 'lucide-react'
import { SUPPORTED_RESOURCE_LINK_MAP } from '~/constants/resource'
import type { JSX } from 'react'
import type { KunPatchResourceResponse } from '~/types/api/kun/moyu-moe'

const storageIcons: { [key: string]: JSX.Element } = {
  s3: <Cloud className="size-4" />,
  user: <LinkIcon className="size-4" />
}

interface Props {
  resource: KunPatchResourceResponse
}

export const KunResourceDownloadCard = ({ resource }: Props) => {
  const resourceLink = `https://www.moyu.moe/patch/${resource.patch_id}/resource#kun_patch_resource_${resource.id}`

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center gap-2">
        <Chip
          color="secondary"
          variant="flat"
          size="sm"
          startContent={storageIcons[resource.storage]}
        >
          {SUPPORTED_RESOURCE_LINK_MAP[resource.storage as 's3' | 'user']}
        </Chip>
        <Chip
          variant="flat"
          size="sm"
          startContent={<Database className="w-4 h-4" />}
        >
          {resource.size}
        </Chip>
      </div>

      <p className="text-sm text-default-500">
        点击前往下面的页面以下载游戏补丁
      </p>

      <Link
        isExternal
        underline="always"
        className="block break-all"
        href={resourceLink}
      >
        {resourceLink}
      </Link>
    </div>
  )
}
