'use client'

import { Button, Select, SelectItem, Tab, Tabs } from '@heroui/react'
import { useEffect, useState } from 'react'
import { kunFetchGet } from '~/utils/kunFetch'
import { KunCardSkeleton } from '~/components/kun/CardSkeleton'
import { useMounted } from '~/hooks/useMounted'
import { ReportCard } from './ReportCard'
import { KunPagination } from '~/components/kun/Pagination'
import type { AdminReport, AdminReportTargetType } from '~/types/api/admin'

type ReportTab = 'pending' | 'handled'

interface Props {
  initialReports: AdminReport[]
  total: number
  title: string
  targetType: AdminReportTargetType
}

export const Report = ({ initialReports, total, title, targetType }: Props) => {
  const [reports, setReports] = useState<AdminReport[]>(initialReports)
  const [activeTab, setActiveTab] = useState<ReportTab>('pending')
  const [totalCount, setTotalCount] = useState(total)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(30)
  const isMounted = useMounted()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fetchData = async (targetPage = page, targetTab = activeTab) => {
    setLoading(true)
    setError('')

    try {
      const response = await kunFetchGet<
        KunResponse<{
          reports: AdminReport[]
          total: number
        }>
      >('/admin/report', {
        page: targetPage,
        limit,
        tab: targetTab,
        targetType
      })
      if (typeof response === 'string') {
        setError(response)
        return
      }
      setReports(response.reports)
      setTotalCount(response.total)
    } catch {
      setError('网络错误, 请稍后重试')
    } finally {
      setLoading(false)
    }
  }
  // 处理成功后在本地移除该举报 (服务端会一并处理同目标的其他待处理举报),
  // 只有当前页被抽空且不在第一页时才回退页码走正常 refetch
  const handleReportsHandled = (handled: AdminReport) => {
    const targetId =
      handled.targetType === 'comment'
        ? handled.comment?.id
        : handled.rating?.id
    const isRelated = (report: AdminReport) => {
      if (report.id === handled.id) {
        return true
      }
      if (!targetId || report.targetType !== handled.targetType) {
        return false
      }
      const reportTargetId =
        handled.targetType === 'comment'
          ? report.comment?.id
          : report.rating?.id
      return reportTargetId === targetId
    }
    const removedCount = reports.filter(isRelated).length
    if (removedCount >= reports.length && page > 1) {
      setPage(page - 1)
      return
    }
    setReports((prev) => prev.filter((report) => !isRelated(report)))
    setTotalCount((prev) => Math.max(0, prev - removedCount))
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchData(page, activeTab)
  }, [page, limit, activeTab, isMounted, targetType])

  if (!isMounted) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <KunCardSkeleton count={3} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => {
          const nextTab = key.toString() as ReportTab
          if (nextTab === activeTab) {
            return
          }
          setActiveTab(nextTab)
          setPage(1)
        }}
      >
        <Tab key="pending" title="未处理" />
        <Tab key="handled" title="已处理" />
      </Tabs>

      <div className="space-y-4">
        {loading ? (
          <KunCardSkeleton count={3} />
        ) : error ? (
          <div className="space-y-3 py-12 text-center">
            <p className="text-danger">{error}</p>
            <Button variant="flat" onPress={() => fetchData()}>
              重试
            </Button>
          </div>
        ) : reports.length ? (
          <>
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onHandled={handleReportsHandled}
              />
            ))}
          </>
        ) : (
          <div className="space-y-1 py-12 text-center">
            <p className="text-default-600">
              {activeTab === 'pending' ? '暂无未处理举报' : '暂无已处理举报'}
            </p>
            <p className="text-sm text-default-500">
              {activeTab === 'pending'
                ? '新举报会在这里排队, 当前无需处理'
                : '处理过的举报会归档在这里, 可切换到「未处理」查看待办'}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <KunPagination
          total={Math.max(1, Math.ceil(totalCount / limit))}
          page={page}
          onPageChange={setPage}
          isLoading={loading}
        />
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-default-500">
        <span>每页显示</span>
        <Select
          aria-label="每页显示数量"
          size="sm"
          className="w-20"
          selectedKeys={new Set([String(limit)])}
          onSelectionChange={(keys) => {
            const val = Number(Array.from(keys)[0])
            if (val && val !== limit) {
              setLimit(val)
              setPage(1)
            }
          }}
        >
          <SelectItem key="30">30</SelectItem>
          <SelectItem key="50">50</SelectItem>
          <SelectItem key="100">100</SelectItem>
        </Select>
        <span>条，共 {totalCount} 条</span>
      </div>
    </div>
  )
}
