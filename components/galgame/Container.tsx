'use client'

import { useEffect, useRef, useState } from 'react'
import { kunFetchGet } from '~/utils/kunFetch'
import { GalgameCard } from './Card'
import { FilterBar } from './FilterBar'
import { KunHeader } from '../kun/Header'
import { KunPagination } from '../kun/Pagination'
import type { SortField, SortOrder } from './_sort'
import { DEFAULT_GALGAME_MIN_RATING_COUNT } from '~/utils/galgameFilter'

interface Props {
  initialGalgames: GalgameCard[]
  initialTotal: number
  filterEndYear: number
}

export const CardContainer = ({
  initialGalgames,
  initialTotal,
  filterEndYear
}: Props) => {
  const didSkipInitialFetch = useRef(false)

  const [galgames, setGalgames] = useState<GalgameCard[]>(initialGalgames)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('resource_update_time')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selectedYears, setSelectedYears] = useState<string[]>(['all'])
  const [selectedMonths, setSelectedMonths] = useState<string[]>(['all'])
  const [page, setPage] = useState(1)
  const [minRatingCount, setMinRatingCount] = useState(
    DEFAULT_GALGAME_MIN_RATING_COUNT
  )
  const withPageReset = <T,>(setter: (value: T) => void) => {
    return (value: T) => {
      setPage(1)
      setter(value)
    }
  }

  const fetchPatches = async () => {
    setLoading(true)

    const { galgames, total } = await kunFetchGet<{
      galgames: GalgameCard[]
      total: number
    }>('/galgame', {
      selectedType,
      selectedLanguage,
      selectedPlatform,
      sortField,
      sortOrder,
      page,
      limit: 24,
      yearString: JSON.stringify(selectedYears),
      monthString: JSON.stringify(selectedMonths),
      minRatingCount: sortField === 'rating' ? minRatingCount : 0
    })

    setGalgames(galgames)
    setTotal(total)
    setLoading(false)
  }

  useEffect(() => {
    if (!didSkipInitialFetch.current) {
      didSkipInitialFetch.current = true
      return
    }

    fetchPatches()
  }, [
    sortField,
    sortOrder,
    selectedType,
    selectedLanguage,
    selectedPlatform,
    page,
    selectedYears,
    selectedMonths,
    sortField === 'rating' ? minRatingCount : null
  ])

  return (
    <div className="container mx-auto my-4 space-y-6">
      <KunHeader
        name="Galgame"
        description="这里展示了本站所有的 Galgame, 您可以使用多个条件的组合进行筛选"
      />

      <FilterBar
        selectedType={selectedType}
        setSelectedType={withPageReset(setSelectedType)}
        sortField={sortField}
        setSortField={withPageReset(setSortField)}
        sortOrder={sortOrder}
        setSortOrder={withPageReset(setSortOrder)}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={withPageReset(setSelectedLanguage)}
        selectedPlatform={selectedPlatform}
        setSelectedPlatform={withPageReset(setSelectedPlatform)}
        selectedYears={selectedYears}
        setSelectedYears={withPageReset(setSelectedYears)}
        selectedMonths={selectedMonths}
        setSelectedMonths={withPageReset(setSelectedMonths)}
        minRatingCount={minRatingCount}
        setMinRatingCount={withPageReset(setMinRatingCount)}
        endYear={filterEndYear}
      />

      <div className="grid grid-cols-2 gap-2 mx-auto mb-8 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {galgames.map((pa) => (
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
    </div>
  )
}
