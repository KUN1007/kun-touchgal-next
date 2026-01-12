'use client'

import { useEffect, useState } from 'react'
import { KunLoading } from '~/components/kun/Loading'
import { kunFetchPost } from '~/utils/kunFetch'
import { KunHeader } from '~/components/kun/Header'
import { KunNull } from '~/components/kun/Null'
import { GalgameCard } from '~/components/galgame/Card'
import { useSearchStore } from '~/store/searchStore'
import { SearchHistory } from './SearchHistory'
import { KunPagination } from '~/components/kun/Pagination'
import { SearchSuggestion } from './Suggestion'
import { SearchOption } from './Option'
import { useDebounce } from 'use-debounce'
import { SearchInput } from './Input'
import { FilterBar } from '~/components/galgame/FilterBar'
import { useSettingStore } from '~/store/settingStore'
import type { SearchSuggestionType } from '~/types/api/search'
import type { SortField, SortOrder } from '~/components/galgame/_sort'

const MAX_HISTORY_ITEMS = 10

export const SearchPage = () => {
  const [query, setQuery] = useState('')
  const [debouncedQuery] = useDebounce(query, 500)
  const [hasSearched, setHasSearched] = useState(false)
  const [patches, setPatches] = useState<GalgameCard[]>([])
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
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

  const [showHistory, setShowHistory] = useState(false)
  const searchData = useSearchStore((state) => state.data)
  const setSearchData = useSearchStore((state) => state.setData)

  const settings = useSettingStore((state) => state.data)
  const isNSFWEnabled =
    settings.kunNsfwEnable === 'nsfw' || settings.kunNsfwEnable === 'all'

  const addToHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      return
    }
    const newHistory = [
      searchQuery,
      ...searchData.searchHistory.filter((item) => item !== searchQuery)
    ].slice(0, MAX_HISTORY_ITEMS)

    setSearchData({ ...searchData, searchHistory: newHistory })
  }

  const handleSearch = async (currentPage = page) => {
    if (!selectedSuggestions.length) {
      return
    }

    setLoading(true)
    setShowHistory(false)
    setShowSuggestions(false)

    const { galgames, total } = await kunFetchPost<{
      galgames: GalgameCard[]
      total: number
    }>('/search', {
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
      selectedMonths
    })

    setPatches(galgames)
    setTotal(total)
    setHasSearched(true)
    setLoading(false)

    const hasTag = selectedSuggestions.some((s) => s.type === 'tag')
    if (!hasTag) {
      addToHistory(
        selectedSuggestions.find((s) => s.type === 'keyword')?.name ?? ''
      )
    }
  }

  useEffect(() => {
    if (selectedSuggestions.length) {
      handleSearch()
    } else {
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
    selectedSuggestions,
    searchData.searchInAlias,
    searchData.searchInIntroduction,
    searchData.searchInTag
  ])

  return (
    <div className="relative w-full my-4 space-y-6">
      <KunHeader
        name="搜索 Galgame"
        headerEndContent={<SearchOption />}
        endContent={
          <div className="text-default-500">
            <p>
              输入内容并点击搜索按钮以搜索 Galgame,
              搜索设置默认搜索游戏标题和别名。
            </p>
            <p>
              搜索技巧 - 部分游戏名查找: 要查找游戏《千恋万花》，您应该搜索
              “千恋” 即可，而不是搜索 “千恋万花”
            </p>
          </div>
        }
      />

      <SearchInput
        query={query}
        setQuery={setQuery}
        setShowSuggestions={setShowSuggestions}
        selectedSuggestions={selectedSuggestions}
        setSelectedSuggestions={setSelectedSuggestions}
        setShowHistory={setShowHistory}
      />

      {showSuggestions && (
        <SearchSuggestion
          query={debouncedQuery}
          setQuery={setQuery}
          setSelectedSuggestions={setSelectedSuggestions}
        />
      )}

      <SearchHistory
        showHistory={showHistory}
        setSelectedSuggestions={setSelectedSuggestions}
        setShowHistory={setShowHistory}
      />

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
      />

      {loading ? (
        <KunLoading hint="正在搜索中..." />
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
            <KunNull
              message={
                isNSFWEnabled
                  ? '您已启用显示 NSFW 内容, 但未找到相关内容, 请尝试使用游戏的日文原名搜索'
                  : '未找到相关内容, 请尝试使用游戏的日文原名搜索或打开 NSFW'
              }
            />
          )}
        </div>
      )}
    </div>
  )
}
