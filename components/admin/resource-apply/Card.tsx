import { Card, CardBody } from '@heroui/react'
import { Chip } from '@heroui/react'
import { Download, Heart } from 'lucide-react'
import Link from 'next/link'
import { formatTimeDifference } from '~/utils/time'
import { KunPatchAttribute } from '~/components/kun/PatchAttribute'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import { SUPPORTED_RESOURCE_LINK_MAP } from '~/constants/resource'
import { RESOURCE_STATUS_MAP } from '~/constants/admin'
import type { AdminResource } from '~/types/api/admin'

interface Props {
  resource: AdminResource
  actions: React.ReactNode
}

export const AdminResourceApplyCard = ({ resource, actions }: Props) => {
  return (
    <Card className="w-full">
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <KunUser
            user={resource.user}
            userProps={{
              name: resource.user.name,
              description: `${formatTimeDifference(resource.created)} 上传了首个补丁资源`,
              avatarProps: {
                showFallback: true,
                src: resource.user.avatar,
                name: resource.user.name.charAt(0).toUpperCase()
              }
            }}
          />

          <div className="flex flex-col items-end gap-2">
            <Chip size="sm" variant="flat" color="warning">
              {RESOURCE_STATUS_MAP[resource.status] ?? '待审核'}
            </Chip>
          </div>
        </div>

        <div className="space-y-1">
          <Link
            href={`/${resource.uniqueId}`}
            className="sm:text-lg text-base font-semibold hover:text-primary-500 transition-colors"
          >
            {resource.patchName}
          </Link>
          {resource.name && (
            <p className="text-sm text-default-600 break-all whitespace-pre-wrap">
              {resource.name}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <KunPatchAttribute
            types={resource.type}
            languages={resource.language}
            platforms={resource.platform}
            size="sm"
          />
          <Chip size="sm" color="warning" variant="flat">
            {resource.size}
          </Chip>
          <Chip size="sm" variant="flat">
            {SUPPORTED_RESOURCE_LINK_MAP[resource.storage]}
          </Chip>
        </div>

        <div className="grid gap-2 text-xs sm:text-sm text-default-600">
          <div>
            <span className="font-medium">下载链接：</span>
            <span className="break-all">{resource.content}</span>
          </div>
          {resource.hash && (
            <div>
              <span className="font-medium">哈希：</span>
              <span className="break-all">{resource.hash}</span>
            </div>
          )}
          {resource.code && (
            <div>
              <span className="font-medium">提取码：</span>
              <span className="break-all">{resource.code}</span>
            </div>
          )}
          {resource.password && (
            <div>
              <span className="font-medium">解压密码：</span>
              <span className="break-all">{resource.password}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end">{actions}</div>
      </CardBody>
    </Card>
  )
}
