'use client'

import { useShallow } from 'zustand/react/shallow'
import { useEffect, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { kunFetchDelete, kunFetchGet, kunFetchPost } from '~/utils/kunFetch'
import { Chip } from '@heroui/chip'
import { Button } from '@heroui/button'
import { useDisclosure } from '@heroui/modal'
import { CircleOff, Pencil } from 'lucide-react'
import { TagDetail } from '~/types/api/tag'
import { KunLoading } from '~/components/kun/Loading'
import { KunHeader } from '~/components/kun/Header'
import { useMounted } from '~/hooks/useMounted'
import { GalgameCard } from '~/components/galgame/Card'
import { KunNull } from '~/components/kun/Null'
import { EditTagModal } from './EditTagModal'
import { DeleteTagModal } from './DeleteTagModal'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import { KunTimeAgo } from '~/components/kun/TimeAgo'
import { useUserStore } from '~/store/userStore'
import { useSearchParams } from 'next/navigation'
import { KunPagination } from '~/components/kun/Pagination'
import { FilterBar } from '~/components/galgame/FilterBar'
import type { SortField, SortOrder } from '~/components/galgame/_sort'
import {
  DEFAULT_GALGAME_FILTER_VALUE,
  DEFAULT_GALGAME_SORT_FIELD,
  DEFAULT_GALGAME_SORT_ORDER,
  DEFAULT_TAG_COMPANY_MIN_RATING_COUNT,
  parseGalgameFilterArray,
  parseNonNegativeIntParam,
  parsePositiveIntParam
} from '~/utils/galgameFilter'
import { errorReporter, kunErrorHandler } from '~/utils/kunErrorHandler'
import toast from 'react-hot-toast'

interface UpdateBlockedTagResponse {
  blockedTagIds: number[]
}

interface Props {
  initialTag: TagDetail
  initialPatches: GalgameCard[]
  total: number
  filterEndYear: number
}

export const TagDetailContainer = ({
  initialTag,
  initialPatches,
  total,
  filterEndYear
}: Props) => {
  const isMounted = useMounted()
  const { user, setUser } = useUserStore(
    useShallow((state) => ({ user: state.user, setUser: state.setUser }))
  )
  const searchParams = useSearchParams()
  const [page, setPage] = useState(
    parsePositiveIntParam(searchParams.get('page'), 1)
  )
  const [selectedType, setSelectedType] = useState(
    searchParams.get('selectedType') || DEFAULT_GALGAME_FILTER_VALUE
  )
  const [selectedLanguage, setSelectedLanguage] = useState(
    searchParams.get('selectedLanguage') || DEFAULT_GALGAME_FILTER_VALUE
  )
  const [selectedPlatform, setSelectedPlatform] = useState(
    searchParams.get('selectedPlatform') || DEFAULT_GALGAME_FILTER_VALUE
  )
  const [sortField, setSortField] = useState<SortField>(
    (searchParams.get('sortField') as SortField) || DEFAULT_GALGAME_SORT_FIELD
  )
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    (searchParams.get('sortOrder') as SortOrder) || DEFAULT_GALGAME_SORT_ORDER
  )
  const [selectedYears, setSelectedYears] = useState<string[]>(
    parseGalgameFilterArray(searchParams.get('yearString'))
  )
  const [selectedMonths, setSelectedMonths] = useState<string[]>(
    parseGalgameFilterArray(searchParams.get('monthString'))
  )
  const [minRatingCount, setMinRatingCount] = useState(
    parseNonNegativeIntParam(
      searchParams.get('minRatingCount'),
      DEFAULT_TAG_COMPANY_MIN_RATING_COUNT
    )
  )
  const [debouncedMinRatingCount] = useDebounce(minRatingCount, 400)

  const [tag, setTag] = useState(initialTag)
  const [patches, setPatches] = useState<GalgameCard[]>(initialPatches)
  const [totalCount, setTotalCount] = useState(total)
  const [loading, setLoading] = useState(false)
  const [updatingBlockedTag, setUpdatingBlockedTag] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const isBlocked = user.blockedTagIds.includes(tag.id)
  const withPageReset = <T,>(setter: (value: T) => void) => {
    return (value: T) => {
      setPage(1)
      setter(value)
    }
  }

  const fetchPatches = async () => {
    setLoading(true)

    try {
      const response = await kunFetchGet<
        | {
            galgames: GalgameCard[]
            total: number
          }
        | string
      >('/tag/galgame', {
        tagId: tag.id,
        page,
        limit: 24,
        selectedType,
        selectedLanguage,
        selectedPlatform,
        sortField,
        sortOrder,
        yearString: JSON.stringify(selectedYears),
        monthString: JSON.stringify(selectedMonths),
        minRatingCount: sortField === 'rating' ? debouncedMinRatingCount : 0
      })

      if (typeof response === 'string') {
        kunErrorHandler(response, () => {})
        setPatches([])
        setTotalCount(0)
        return
      }

      setPatches(response.galgames)
      setTotalCount(response.total)
    } catch (error) {
      setPatches([])
      setTotalCount(0)
      errorReporter(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchPatches()
  }, [
    page,
    selectedType,
    selectedLanguage,
    selectedPlatform,
    sortField,
    sortOrder,
    selectedYears,
    selectedMonths,
    sortField === 'rating' ? debouncedMinRatingCount : null
  ])

  const handleToggleBlockedTag = async () => {
    if (!user.uid || updatingBlockedTag) {
      return
    }

    setUpdatingBlockedTag(true)
    try {
      const response = isBlocked
        ? await kunFetchDelete<KunResponse<UpdateBlockedTagResponse>>(
            '/user/setting/blocked-tag',
            { tagId: tag.id }
          )
        : await kunFetchPost<KunResponse<UpdateBlockedTagResponse>>(
            '/user/setting/blocked-tag',
            { tagId: tag.id }
          )

      if (typeof response === 'string') {
        toast.error(response)
        return
      }

      setUser({ ...user, blockedTagIds: response.blockedTagIds })

      if (isBlocked) {
        toast.success(`已取消屏蔽标签「${tag.name}」`)
        await fetchPatches()
      } else {
        setPatches([])
        setTotalCount(0)
        toast.success(`已屏蔽标签「${tag.name}」`)
      }
    } finally {
      setUpdatingBlockedTag(false)
    }
  }

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
                description: (
                  <>
                    创建于 <KunTimeAgo date={tag.created} />
                  </>
                ),
                avatarProps: {
                  src: tag.user?.avatar
                }
              }}
            />

            <div className="flex items-center gap-2">
              <Button
                variant="flat"
                color={isBlocked ? 'default' : 'danger'}
                isLoading={updatingBlockedTag}
                onPress={handleToggleBlockedTag}
                startContent={<CircleOff />}
              >
                {isBlocked ? '取消屏蔽' : '屏蔽该标签'}
              </Button>

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

      <FilterBar
        selectedType={selectedType}
        setSelectedType={withPageReset(setSelectedType)}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={withPageReset(setSelectedLanguage)}
        selectedPlatform={selectedPlatform}
        setSelectedPlatform={withPageReset(setSelectedPlatform)}
        sortField={sortField}
        setSortField={withPageReset(setSortField)}
        sortOrder={sortOrder}
        setSortOrder={withPageReset(setSortOrder)}
        selectedYears={selectedYears}
        setSelectedYears={withPageReset(setSelectedYears)}
        selectedMonths={selectedMonths}
        setSelectedMonths={withPageReset(setSelectedMonths)}
        minRatingCount={minRatingCount}
        setMinRatingCount={withPageReset(setMinRatingCount)}
        defaultMinRatingCount={DEFAULT_TAG_COMPANY_MIN_RATING_COUNT}
        endYear={filterEndYear}
      />

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

          {totalCount > 24 && (
            <div className="flex justify-center">
              <KunPagination
                total={Math.ceil(totalCount / 24)}
                page={page}
                onPageChange={setPage}
                isLoading={loading}
              />
            </div>
          )}

          {!totalCount && (
            <KunNull
              message={
                isBlocked
                  ? '您已屏蔽该标签, 关联游戏不会在公开列表中显示'
                  : '这个标签暂无 Galgame 使用'
              }
            />
          )}
        </div>
      )}
    </div>
  )
}
