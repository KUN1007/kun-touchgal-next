import Link from 'next/link'
import { Card, CardBody } from '@heroui/card'
import { Chip } from '@heroui/chip'
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
      className="group flex h-full w-full flex-col overflow-hidden rounded-[22px] border-none bg-background shadow-[0_20px_55px_rgba(15,23,42,0.16)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(15,23,42,0.2)] dark:bg-content1 dark:shadow-[0_20px_55px_rgba(0,0,0,0.45)]"
    >
      <CardBody className="flex h-full flex-col gap-3 p-4 sm:p-5">
        <div className="space-y-1.5">
          <h2 className="line-clamp-2 break-all text-base font-semibold leading-snug transition-colors group-hover:text-primary-500 sm:text-lg">
            {resource.name || resource.patchName}
          </h2>

          {resource.name && (
            <p className="line-clamp-2 text-small leading-5 text-default-500">
              {resource.patchName}
            </p>
          )}
        </div>

        <KunPatchAttribute
          types={resource.type}
          languages={resource.language}
          platforms={resource.platform}
          size="sm"
          hidePatchType
        />

        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <div className="min-w-0">
            <KunUser
              user={resource.user}
              userProps={{
                name: resource.user.name,
                description: `${formatTimeDifference(resource.created)} • 已发布资源 ${resource.user.patchCount} 个`,
                avatarProps: {
                  showFallback: true,
                  src: resource.user.avatar,
                  name: resource.user.name.charAt(0).toUpperCase(),
                  size: 'sm'
                }
              }}
            />
          </div>
          {primaryLink && (
            <Chip size="sm" variant="flat" className="shrink-0">
              {primaryLink.size}
            </Chip>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
