'use client'

import { useEffect, useState } from 'react'
import { kunFetchGet } from '~/utils/kunFetch'
import { errorReporter, kunErrorHandler } from '~/utils/kunErrorHandler'
import { KunPagination } from '~/components/kun/Pagination'
import { KunLoading } from '~/components/kun/Loading'
import { KunNull } from '~/components/kun/Null'
import { UserResourceCard } from './Card'
import type { UserResource as UserResourceType } from '~/types/api/user'

interface Props {
  resources: UserResourceType[]
  total: number
  uid: number
}

export const UserResource = ({ resources, total, uid }: Props) => {
  const [patches, setPatches] = useState<UserResourceType[]>(resources)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  const fetchPatches = async () => {
    setLoading(true)
    try {
      const response = await kunFetchGet<
        KunResponse<{
          resources: UserResourceType[]
          total: number
        }>
      >('/user/profile/resource', {
        uid,
        page,
        limit: 20
      })

      kunErrorHandler(response, (value) => setPatches(value.resources))
    } catch (error) {
      errorReporter(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (page === 1) {
      setPatches(resources)
      return
    }
    fetchPatches()
  }, [page, resources, uid])

  return (
    <div className="space-y-4">
      {loading ? (
        <KunLoading hint="正在获取资源数据..." />
      ) : (
        <>
          {patches.map((resource) => (
            <UserResourceCard key={resource.id} resource={resource} />
          ))}
        </>
      )}

      {!total && <KunNull message="这个孩子还没有发布过资源哦" />}

      {total > 20 && (
        <div className="flex justify-center">
          <KunPagination
            total={Math.ceil(total / 20)}
            page={page}
            onPageChange={setPage}
            isLoading={loading}
          />
        </div>
      )}
    </div>
  )
}
