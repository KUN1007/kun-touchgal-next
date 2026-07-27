'use client'

import { Card, CardBody, CardHeader } from '@heroui/card'
import { Chip } from '@heroui/chip'
import { Tooltip } from '@heroui/tooltip'
import { KunPatchAttribute } from '~/components/kun/PatchAttribute'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import { KunTimeAgo } from '~/components/kun/TimeAgo'
import { ResourceLikeButton } from '~/components/patch/resource/ResourceLike'
import { ResourceDownloadCard } from '~/components/patch/resource/DownloadCard'
import { GalgameCard } from '~/components/galgame/Card'
import { Comments } from '~/components/patch/comment/Comments'
import { getResourcePageTitle } from '~/utils/patch/getResourcePageTitle'
import type { PatchResourceDetail } from '~/app/api/patch/resource/detail'

interface Props {
  detail: PatchResourceDetail
}

export const ResourceDetail = ({ detail }: Props) => {
  const { resource, galgame } = detail
  const isPending = resource.status === 2 || resource.status === 3

  return (
    <div className="w-full mx-auto max-w-7xl space-y-6">
      <Card>
        <CardHeader className="flex-col items-start gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">
              {getResourcePageTitle(resource)}
            </h1>
            {isPending && (
              <Tooltip content="审核中，仅你和管理员可见">
                <Chip color="warning" variant="flat" size="sm">
                  待审核
                </Chip>
              </Tooltip>
            )}
          </div>
        </CardHeader>

        <CardBody className="space-y-6">
          <KunPatchAttribute
            types={resource.type}
            languages={resource.language}
            platforms={resource.platform}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
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
            <ResourceLikeButton resource={resource} isDisabled={isPending} />
          </div>

          {resource.note && (
            <div>
              <h2 className="mb-2 text-lg font-semibold">资源简介</h2>
              <div
                className="kun-prose max-w-none"
                dangerouslySetInnerHTML={{ __html: resource.noteHtml }}
              />
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start">
          <h2 className="text-lg font-semibold">下载链接</h2>
          <p className="text-sm text-default-500">
            使用资源前请认真阅读资源简介, 以免产生问题
          </p>
        </CardHeader>
        <CardBody className="space-y-3">
          {resource.links.length > 0 ? (
            resource.links.map((link) => (
              <ResourceDownloadCard
                key={link.id}
                resource={resource}
                link={link}
              />
            ))
          ) : (
            <p className="text-sm text-default-500">该资源暂无下载链接</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start">
          <h2 className="text-lg font-semibold">所属游戏</h2>
        </CardHeader>
        <CardBody>
          <div className="w-full max-w-sm">
            <GalgameCard patch={galgame} openOnNewTab={false} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start">
          <h2 className="text-lg font-semibold">资源评论</h2>
          <p className="text-sm text-default-500">
            对该下载资源的评论, 与游戏评论区相互独立
          </p>
        </CardHeader>
        <CardBody>
          <Comments id={resource.patchId} resourceId={resource.id} />
        </CardBody>
      </Card>
    </div>
  )
}
