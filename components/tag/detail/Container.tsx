'use client'

import { useEffect, useState } from 'react'
import { kunFetchGet } from '~/utils/kunFetch'
import { Chip } from '@heroui/chip'
import { Button } from '@heroui/button'
import { useDisclosure } from '@heroui/modal'
import { Pencil } from 'lucide-react'
import { TagDetail } from '~/types/api/tag'
import { KunLoading } from '~/components/kun/Loading'
import { KunHeader } from '~/components/kun/Header'
import { useMounted } from '~/hooks/useMounted'
import { GalgameCard } from '~/components/galgame/Card'
import { KunNull } from '~/components/kun/Null'
import { EditTagModal } from './EditTagModal'
import { DeleteTagModal } from './DeleteTagModal'
import { useRouter } from '@bprogress/next'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import { formatDistanceToNow } from '~/utils/formatDistanceToNow'
import { useUserStore } from '~/store/userStore'
import { useSearchParams } from 'next/navigation'
import { FilterBar } from './FilterBar'
import { KunPagination } from '~/components/kun/Pagination'
import type { SortField } from './_sort'

interface Props {
  initialTag: TagDetail
  initialPatches: GalgameCard[]
  total: number
}

export const TagDetailContainer = ({
  initialTag,
  initialPatches,
  total
}: Props) => {
  const isMounted = useMounted()
  const user = useUserStore((state) => state.user)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [sortField, setSortField] = useState<SortField>(
    (searchParams.get('sortField') as SortField) || 'resource_update_time'
  )

  const [tag, setTag] = useState(initialTag)
  const [patches, setPatches] = useState<GalgameCard[]>(initialPatches)
  const [loading, setLoading] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()

  const fetchPatches = async () => {
    setLoading(true)

    const { galgames } = await kunFetchGet<{
      galgames: GalgameCard[]
      total: number
    }>('/tag/galgame', {
      tagId: tag.id,
      page,
      limit: 24,
      sortField
    })

    setPatches(galgames)
    setLoading(false)
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchPatches()
  }, [page])

  useEffect(() => {
    if (!isMounted) {
      return
    }

    const params = new URLSearchParams()
    params.set('sortField', sortField)

    const queryString = params.toString()
    const url = queryString ? `?${queryString}` : ''
    router.push(url)

    fetchPatches()
  }, [sortField])

  return (
    <div className="w-full my-4 space-y-6">
      <KunHeader
        name={tag.name}
        description={tag.introduction}
        headerEndContent={
          <Chip size="lg" color="primary">
            {tag.count} 个 Galgame
          </Chip>
        }
        endContent={
          <div className="flex justify-between">
            <KunUser
              user={tag.user}
              userProps={{
                name: tag.user.name,
                description: `创建于 ${formatDistanceToNow(tag.created)}`,
                avatarProps: {
                  src: tag.user?.avatar
                }
              }}
            />

            <div className="flex items-center gap-2">
              <DeleteTagModal tag={tag} />

              {user.role > 2 && (
                <Button
                  variant="flat"
                  color="primary"
                  onPress={onOpen}
                  startContent={<Pencil />}
                >
                  编辑该标签
                </Button>
              )}
              <EditTagModal
                tag={tag}
                isOpen={isOpen}
                onClose={onClose}
                onSuccess={(newTag) => {
                  setTag(newTag)
                  onClose()
                }}
              />
            </div>
          </div>
        }
      />

      <FilterBar sortField={sortField} setSortField={setSortField} />

      {tag.alias.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">别名</h2>
          <div className="flex flex-wrap gap-2">
            {tag.alias.map((alias, index) => (
              <Chip key={index} variant="flat" color="secondary">
                {alias}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <KunLoading hint="正在获取 Galgame 中..." />
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-2 mx-auto sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {patches.map((pa) => (
              <GalgameCard key={pa.id} patch={pa} />
            ))}
          </div>

          {total > 24 && (
            <div className="flex justify-center">
              <KunPagination
                total={Math.ceil(total / 24)}
                page={page}
                onPageChange={setPage}
                isLoading={loading}
              />
            </div>
          )}

          {!total && <KunNull message="这个标签暂无 Galgame 使用" />}
        </div>
      )}
    </div>
  )
}
