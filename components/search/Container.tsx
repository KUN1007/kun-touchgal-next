'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { kunFetchPost } from '~/utils/kunFetch'
import { errorReporter, kunErrorHandler } from '~/utils/kunErrorHandler'
import { KunHeader } from '~/components/kun/Header'
import { GalgameCard } from '~/components/galgame/Card'
import { useSearchStore } from '~/store/searchStore'
import { SearchHistory } from './SearchHistory'
import { KunPagination } from '~/components/kun/Pagination'
import { SearchSuggestion, getSearchSuggestionOptionId } from './Suggestion'
import { SearchOption } from './Option'
import { useDebounce } from 'use-debounce'
import { SearchInput } from './Input'
import { FilterBar } from '~/components/galgame/FilterBar'
import { GalgameCardSkeleton } from '~/components/galgame/CardSkeleton'
import { useSettingStore } from '~/store/settingStore'
import { cn } from '~/utils/cn'
import type { FocusEvent } from 'react'
import type { SearchSuggestionNav } from './Suggestion'
import type { SearchSuggestionType } from '~/types/api/search'
import type { SortField, SortOrder } from '~/components/galgame/_sort'

const MAX_HISTORY_ITEMS = 10

interface Props {
  filterEndYear: number
}

export const SearchPage = ({ filterEndYear }: Props) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const latestSearchRequestIdRef = useRef(0)
  const [query, setQuery] = useState('')
  const [debouncedQuery] = useDebounce(query, 500)
  const [hasSearched, setHasSearched] = useState(false)
  const [patches, setPatches] = useState<GalgameCard[]>([])
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const suggestionNavRef = useRef<SearchSuggestionNav | null>(null)
  const [selectedSuggestions, setSelectedSuggestions] = useState<
    SearchSuggestionType[]
  >([])

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('resource_update_time')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selectedYears, setSelectedYears] = useState<string[]>(['all'])
  const [selectedMonths, setSelectedMonths] = useState<string[]>(['all'])
  const [minRatingCount, setMinRatingCount] = useState(10)
  const [debouncedMinRatingCount] = useDebounce(minRatingCount, 400)

  const [showHistory, setShowHistory] = useState(false)
  const searchData = useSearchStore((state) => state.data)
  const setSearchData = useSearchStore((state) => state.setData)
  const [isSearchStoreHydrated, setIsSearchStoreHydrated] = useState(false)

  const settings = useSettingStore((state) => state.data)
  const isNSFWEnabled =
    settings.kunNsfwEnable === 'nsfw' || settings.kunNsfwEnable === 'all'

  useEffect(() => {
    const persist = useSearchStore.persist
    if (!persist || persist.hasHydrated()) {
      setIsSearchStoreHydrated(true)
      return
    }

    let cancelled = false
    const hydrateSearchStore = async () => {
      await persist.rehydrate()
      if (!cancelled) {
        setIsSearchStoreHydrated(true)
      }
    }

    void hydrateSearchStore()

    return () => {
      cancelled = true
    }
  }, [])

  const addToHistory = (suggestions: SearchSuggestionType[]) => {
    if (suggestions.length === 0) {
      return
    }

    const entryKey = suggestions
      .map((s) => `${s.mode}:${s.type}:${s.name}`)
      .sort()
      .join('|')

    const newHistory = [
      suggestions,
      ...searchData.searchHistory.filter((item) => {
        const itemKey = item
          .map((s) => `${s.mode}:${s.type}:${s.name}`)
          .sort()
          .join('|')
        return itemKey !== entryKey
      })
    ].slice(0, MAX_HISTORY_ITEMS)

    setSearchData({ ...searchData, searchHistory: newHistory })
  }

  const handleSearch = async (currentPage = page) => {
    if (!selectedSuggestions.length) {
      return
    }

    const requestId = latestSearchRequestIdRef.current + 1
    latestSearchRequestIdRef.current = requestId

    setLoading(true)
    setShowHistory(false)
    setShowSuggestions(false)

    try {
      const response = await kunFetchPost<
        | {
            galgames: GalgameCard[]
            total: number
          }
        | string
      >('/search', {
        queryString: JSON.stringify(selectedSuggestions),
        limit: 12,
        searchOption: {
          searchInIntroduction: searchData.searchInIntroduction,
          searchInAlias: searchData.searchInAlias,
          searchInTag: searchData.searchInTag
        },

        page: currentPage,
        selectedType,
        selectedLanguage,
        selectedPlatform,
        sortField,
        sortOrder,
        selectedYears,
        selectedMonths,
        minRatingCount: sortField === 'rating' ? debouncedMinRatingCount : 0
      })

      if (requestId !== latestSearchRequestIdRef.current) {
        return
      }

      if (typeof response === 'string') {
        kunErrorHandler(response, () => {})
        setPatches([])
        setTotal(0)
        setHasSearched(true)
        return
      }

      setPatches(Array.isArray(response.galgames) ? response.galgames : [])
      setTotal(typeof response.total === 'number' ? response.total : 0)
      setHasSearched(true)
      if (isSearchStoreHydrated) {
        addToHistory(selectedSuggestions)
      }
    } catch (error) {
      if (requestId !== latestSearchRequestIdRef.current) {
        return
      }

      setPatches([])
      setTotal(0)
      setHasSearched(true)
      errorReporter(error)
    } finally {
      if (requestId === latestSearchRequestIdRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    return () => {
      latestSearchRequestIdRef.current += 1
    }
  }, [])

  useEffect(() => {
    if (!showSuggestions) {
      setActiveSuggestionIndex(-1)
    }
  }, [showSuggestions])

  const handleSearchAreaBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null
    if (next && event.currentTarget.contains(next)) {
      return
    }
    setShowSuggestions(false)
    setShowHistory(false)
  }

  const activeDescendantId =
    activeSuggestionIndex >= 0
      ? getSearchSuggestionOptionId(activeSuggestionIndex)
      : undefined

  useEffect(() => {
    if (selectedSuggestions.length) {
      handleSearch()
    } else {
      latestSearchRequestIdRef.current += 1
      setPatches([])
      setHasSearched(false)
      setPage(1)
      setTotal(0)
      setLoading(false)
    }
  }, [
    page,
    selectedType,
    selectedLanguage,
    selectedPlatform,
    sortField,
    sortOrder,
    selectedYears,
    selectedMonths,
    sortField === 'rating' ? debouncedMinRatingCount : null,
    selectedSuggestions,
    searchData.searchInAlias,
    searchData.searchInIntroduction,
    searchData.searchInTag,
    isSearchStoreHydrated
  ])
  return (
    <div className="relative w-full my-4 space-y-6">
      <KunHeader
        name="搜索 Galgame"
        headerEndContent={isSearchStoreHydrated ? <SearchOption /> : null}
        endContent={
          <div className="text-default-500">
            <p>使用游戏标题的一部分作为关键词搜索更容易找到游戏。</p>
            <p>
              您可以使用多个关键词、标签和会社的组合进行搜索，也可以排除其中任意项。
            </p>
          </div>
        }
      />

      <div className="relative space-y-6" onBlur={handleSearchAreaBlur}>
        <SearchInput
          inputRef={inputRef}
          query={query}
          setQuery={setQuery}
          showSuggestions={showSuggestions}
          setShowSuggestions={setShowSuggestions}
          selectedSuggestions={selectedSuggestions}
          setSelectedSuggestions={setSelectedSuggestions}
          setShowHistory={setShowHistory}
          activeDescendantId={activeDescendantId}
          suggestionNavRef={suggestionNavRef}
        />

        {showSuggestions && (
          <SearchSuggestion
            inputRef={inputRef}
            query={query}
            debouncedQuery={debouncedQuery}
            setQuery={setQuery}
            setSelectedSuggestions={setSelectedSuggestions}
            activeIndex={activeSuggestionIndex}
            setActiveIndex={setActiveSuggestionIndex}
            navRef={suggestionNavRef}
          />
        )}

        {isSearchStoreHydrated && (
          <SearchHistory
            showHistory={showHistory}
            setSelectedSuggestions={setSelectedSuggestions}
            setShowHistory={setShowHistory}
          />
        )}
      </div>

      <FilterBar
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        sortField={sortField}
        setSortField={setSortField}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        selectedPlatform={selectedPlatform}
        setSelectedPlatform={setSelectedPlatform}
        selectedYears={selectedYears}
        setSelectedYears={setSelectedYears}
        selectedMonths={selectedMonths}
        setSelectedMonths={setSelectedMonths}
        minRatingCount={minRatingCount}
        setMinRatingCount={setMinRatingCount}
        endYear={filterEndYear}
      />

      <p
        aria-live="polite"
        className={cn(
          'text-sm text-default-500',
          (loading || !hasSearched || !patches.length) && 'sr-only'
        )}
      >
        {loading
          ? '正在搜索中'
          : hasSearched
            ? patches.length
              ? `共 ${total} 个结果`
              : '未找到相关内容'
            : ''}
      </p>

      {loading ? (
        <div>
          <div
            aria-hidden="true"
            className="mb-6 h-5 w-28 animate-pulse rounded-lg bg-default-200 motion-reduce:animate-none"
          />
          <div className="grid grid-cols-2 gap-2 mx-auto mb-8 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }, (_, index) => (
              <GalgameCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-2 mx-auto mb-8 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {patches.map((pa) => (
              <GalgameCard key={pa.id} patch={pa} />
            ))}
          </div>

          {total > 12 && (
            <div className="flex justify-center">
              <KunPagination
                total={Math.ceil(total / 12)}
                page={page}
                onPageChange={setPage}
                isLoading={loading}
              />
            </div>
          )}

          {hasSearched && patches.length === 0 && (
            <div className="flex flex-col items-center justify-center space-y-4 size-full">
              <Image
                className="rounded-2xl"
                src="/null.webp"
                alt="未找到相关内容"
                width={150}
                height={150}
                priority
              />
              <div className="space-y-1 text-center">
                <p>未找到相关内容</p>
                <p>
                  {isNSFWEnabled
                    ? '请尝试使用游戏的日文原名搜索'
                    : '请尝试使用游戏的日文原名搜索或打开 NSFW'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
