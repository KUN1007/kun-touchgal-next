'use client'

import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  User,
  Tab,
  Tabs
} from '@heroui/react'
import { Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import { useUserStore } from '~/store/userStore'
import { ResourceInfo } from './ResourceInfo'
import { ResourceDownload } from './ResourceDownload'
import {
  RESOURCE_SECTION_MAP,
  SUPPORTED_RESOURCE_SECTION
} from '~/constants/resource'
import { KunResourceInfo } from './kun/KunResourceInfo'
import { KunResourceDownload } from './kun/KunResourceDownload'
import { KunLoading } from '~/components/kun/Loading'
import { KunNull } from '~/components/kun/Null'
import { KUN_PATCH_WEBSITE_GET_PATCH_LIST_ENDPOINT } from '~/config/external-api'
import type { PatchResource } from '~/types/api/patch'
import type {
  HikariResponse,
  KunPatchResourceResponse
} from '~/types/api/kun/moyu-moe'
import Link from 'next/link'
import { kunMoyuMoe } from '~/config/moyu-moe'

type ResourceSection = (typeof SUPPORTED_RESOURCE_SECTION)[number]

interface Props {
  vndbId: string
  resources: PatchResource[]
  setEditResource: (resources: PatchResource) => void
  onOpenEdit: () => void
  onOpenDelete: () => void
  setDeleteResourceId: (resourceId: number) => void
}

export const ResourceTabs = ({
  vndbId,
  resources,
  setEditResource,
  onOpenEdit,
  onOpenDelete,
  setDeleteResourceId
}: Props) => {
  const { user } = useUserStore((state) => state)
  const [selectedSection, setSelectedSection] =
    useState<ResourceSection>('galgame')

  const [kunResources, setKunResources] = useState<KunPatchResourceResponse[]>(
    []
  )
  const [kunLoading, setKunLoading] = useState(false)
  const [kunLoaded, setKunLoaded] = useState(false)

  const fetchKunPatchData = async () => {
    if (!vndbId || kunLoaded) {
      return
    }

    try {
      setKunLoading(true)
      const res = await fetch(
        `${KUN_PATCH_WEBSITE_GET_PATCH_LIST_ENDPOINT}?vndb_id=${vndbId}`
      )
      const response = (await res.json()) as HikariResponse
      if (response.success && response.data) {
        setKunResources(response.data.resource)
      } else {
        setKunResources([])
      }
    } catch (err) {
      setKunResources([])
    } finally {
      setKunLoading(false)
      setKunLoaded(true)
    }
  }

  useEffect(() => {
    if (selectedSection === 'patch') {
      fetchKunPatchData()
    }
  }, [selectedSection])

  const categorizedResources = SUPPORTED_RESOURCE_SECTION.reduce(
    (acc, section) => {
      acc[section] = resources.filter((r) => r.section === section)
      return acc
    },
    {} as Record<ResourceSection, PatchResource[]>
  )

  const renderResourceCard = (resource: PatchResource) => (
    <div
      key={resource.id}
      className="border p-3 rounded-2xl border-default-200"
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <ResourceInfo resource={resource} />
          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" isIconOnly>
                <MoreHorizontal aria-label="资源操作" className="size-4" />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Resource actions"
              disabledKeys={
                user.uid !== resource.userId && user.role < 3
                  ? ['edit', 'delete']
                  : []
              }
            >
              <DropdownItem
                key="edit"
                startContent={<Edit className="size-4" />}
                onPress={() => {
                  setEditResource(resource)
                  onOpenEdit()
                }}
              >
                编辑
              </DropdownItem>
              <DropdownItem
                key="delete"
                className="text-danger"
                color="danger"
                startContent={<Trash2 className="size-4" />}
                onPress={() => {
                  setDeleteResourceId(resource.id)
                  onOpenDelete()
                }}
              >
                删除
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
        <ResourceDownload resource={resource} />
      </div>
    </div>
  )

  return (
    <Tabs
      selectedKey={selectedSection}
      onSelectionChange={(key) => setSelectedSection(key as ResourceSection)}
      className="mb-4"
    >
      {SUPPORTED_RESOURCE_SECTION.map((section) => {
        const sectionResources = categorizedResources[section]
        const official = sectionResources.filter((r) => r.user?.role > 2)
        const community = sectionResources.filter((r) => !(r.user?.role > 2))

        return (
          <Tab
            key={section}
            title={RESOURCE_SECTION_MAP[section]}
            className="w-full"
          >
            <div className="space-y-6">
              {official.length > 0 && (
                <Card>
                  <CardHeader>
                    <Link href="/">
                      <User
                        avatarProps={{
                          src: '/favicon.webp',
                          classNames: {
                            base: 'bg-transparent'
                          }
                        }}
                        description={`${kunMoyuMoe.titleShort} 官方提供的 Galgame 下载资源`}
                        name={`${kunMoyuMoe.titleShort} 官方 (推荐下载)`}
                      />
                    </Link>
                  </CardHeader>
                  <CardBody className="space-y-2 gap-3">
                    {official.map((res) => renderResourceCard(res))}
                  </CardBody>
                </Card>
              )}

              {section === 'patch' && (
                <Card>
                  <CardHeader>
                    <Link target="_blank" href="https://www.moyu.moe/">
                      <User
                        avatarProps={{
                          src: '/moyu-moe.webp',
                          classNames: {
                            base: 'bg-transparent'
                          }
                        }}
                        description="来自鲲 Galgame 补丁的补丁下载资源"
                        name="鲲 Galgame 补丁"
                      />
                    </Link>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    {kunLoading ? (
                      <KunLoading hint="正在加载鲲 Galgame 补丁..." />
                    ) : kunResources.length > 0 ? (
                      <>
                        {kunResources.map((resource) => (
                          <div
                            key={resource.id}
                            className="border p-3 rounded-2xl border-default-200"
                          >
                            <div className="space-y-2">
                              <KunResourceInfo resource={resource} />
                              <KunResourceDownload resource={resource} />
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      kunLoaded && (
                        <KunNull message="本游戏在鲲 Galgame 补丁暂无对应补丁" />
                      )
                    )}
                  </CardBody>
                </Card>
              )}

              {community.length > 0 && (
                <Card>
                  <CardHeader>
                    <Link target="_blank" href={kunMoyuMoe.domain.forum}>
                      <User
                        avatarProps={{
                          src: '/sooner/琥珀.webp',
                          classNames: {
                            base: 'bg-transparent'
                          }
                        }}
                        description={`来自 ${kunMoyuMoe.titleShort} 用户自行发布的下载资源`}
                        name={`${kunMoyuMoe.titleShort} 社区下载资源`}
                      />
                    </Link>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    {community.map((res) => renderResourceCard(res))}
                  </CardBody>
                </Card>
              )}

              {section !== 'patch' &&
                official.length === 0 &&
                community.length === 0 && (
                  <KunNull
                    message={`本游戏暂无 ${RESOURCE_SECTION_MAP[section]}`}
                  />
                )}
            </div>
          </Tab>
        )
      })}
    </Tabs>
  )
}
