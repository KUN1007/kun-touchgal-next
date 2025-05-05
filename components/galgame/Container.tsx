'use client'

import { useEffect, useState } from 'react'
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates
} from 'nuqs'
import { kunFetchGet } from '~/utils/kunFetch'
import { GalgameCard } from './Card'
import { FilterBar } from './FilterBar'
import { KunHeader } from '../kun/Header'
import { KunPagination } from '../kun/Pagination'
import { sortFieldLiteral, sortOrderLiteral } from './_sort'

interface Props {
  initialGalgames: GalgameCard[]
  initialTotal: number
}

export const CardContainer = ({ initialGalgames, initialTotal }: Props) => {
  const [galgames, setGalgames] = useState<GalgameCard[]>(initialGalgames)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)

  const [params, setParams] = useQueryStates({
    selectedType: parseAsString.withDefault('all'),
    selectedLanguage: parseAsString.withDefault('all'),
    selectedPlatform: parseAsString.withDefault('all'),
    sortField: parseAsStringLiteral(sortFieldLiteral).withDefault(
      'resource_update_time'
    ),
    sortOrder: parseAsStringLiteral(sortOrderLiteral).withDefault('desc'),
    selectedYears: parseAsString.withDefault(JSON.stringify(['all'])),
    selectedMonths: parseAsString.withDefault(JSON.stringify(['all'])),
    page: parseAsInteger.withDefault(1)
  })

  useEffect(() => {
    fetchPatches()
  }, [params])

  const fetchPatches = async () => {
    setLoading(true)
    const { selectedYears, selectedMonths, ...restParams } = params

    const { galgames, total } = await kunFetchGet<{
      galgames: GalgameCard[]
      total: number
    }>('/galgame', {
      ...restParams,
      limit: 24,
      yearString: selectedYears,
      monthString: selectedMonths
    })

    setGalgames(galgames)
    setTotal(total)
    setLoading(false)
  }

  return (
    <div className="container mx-auto my-4 space-y-6">
      <KunHeader
        name="Galgame"
        description="这里展示了本站所有的 Galgame, 您可以点击进入以下载 Galgame 资源"
      />

      <FilterBar
        selectedType={params.selectedType}
        setSelectedType={(selectedType) => setParams({ selectedType })}
        sortField={params.sortField}
        setSortField={(sortField) => setParams({ sortField })}
        sortOrder={params.sortOrder}
        setSortOrder={(sortOrder) => setParams({ sortOrder })}
        selectedLanguage={params.selectedLanguage}
        setSelectedLanguage={(selectedLanguage) =>
          setParams({ selectedLanguage })
        }
        selectedPlatform={params.selectedPlatform}
        setSelectedPlatform={(selectedPlatform) =>
          setParams({ selectedPlatform })
        }
        selectedYears={JSON.parse(params.selectedYears)}
        setSelectedYears={(selectedYears) =>
          setParams({ selectedYears: JSON.stringify(selectedYears) })
        }
        selectedMonths={JSON.parse(params.selectedMonths)}
        setSelectedMonths={(selectedMonths) =>
          setParams({ selectedMonths: JSON.stringify(selectedMonths) })
        }
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
            page={params.page}
            onPageChange={(page) => setParams({ page })}
            isLoading={loading}
          />
        </div>
      )}
    </div>
  )
}
