import Link from 'next/link'
import { Card, CardBody } from '@heroui/card'
import { Chip } from '@heroui/chip'
import { Download, Heart } from 'lucide-react'
import { formatTimeDifference } from '~/utils/time'
import { KunPatchAttribute } from '~/components/kun/PatchAttribute'
import { KunUser } from '../kun/floating-card/KunUser'
import type { PatchResource } from '~/types/api/resource'

interface Props {
  resource: PatchResource
}

export const ResourceCard = ({ resource }: Props) => {
  const primaryLink = resource.primaryLink

  return (
    <Card
      isPressable
      as={Link}
      href={`/${resource.uniqueId}`}
      className="w-full"
    >
      <CardBody className="space-y-2">
        <div className="flex">
          <KunUser
            user={resource.user}
            userProps={{
              name: resource.user.name,
              description: `${formatTimeDifference(resource.created)} • 已发布资源 ${resource.user.patchCount} 个`,
              avatarProps: {
                showFallback: true,
                src: resource.user.avatar,
                name: resource.user.name.charAt(0).toUpperCase()
              }
            }}
          />
        </div>

        <h2 className="sm:text-lg text-sm transition-colors line-clamp-2 hover:text-primary-500">
          {resource.patchName}
        </h2>

        {resource.name && (
          <p className="break-all whitespace-pre-wrap text-small text-default-500">
            {resource.name}
          </p>
        )}

        <KunPatchAttribute
          types={resource.type}
          languages={resource.language}
          platforms={resource.platform}
          size="sm"
        />

        <div className="flex items-center justify-between text-small text-default-500">
          <div className="flex gap-4">
            <div className="flex items-center gap-1">
              <Heart size={16} />
              {resource.likeCount}
            </div>
            <div className="flex items-center gap-1">
              <Download size={16} />
              {resource.download}
            </div>
          </div>
          <div className="flex gap-2">
            {primaryLink && (
              <Chip size="sm" variant="flat">
                {primaryLink.size}
              </Chip>
            )}
            {resource.linkCount > 1 && (
              <Chip size="sm" variant="flat" color="primary">
                {resource.linkCount} 个链接
              </Chip>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
