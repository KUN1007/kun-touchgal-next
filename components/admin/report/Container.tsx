'use client'

import { Select, SelectItem, Tab, Tabs } from '@heroui/react'
import { useEffect, useState } from 'react'
import { kunFetchGet } from '~/utils/kunFetch'
import { KunLoading } from '~/components/kun/Loading'
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
  const fetchData = async (targetPage = page, targetTab = activeTab) => {
    setLoading(true)

    const response = await kunFetchGet<{
      reports: AdminReport[]
      total: number
    }>('/admin/report', {
      page: targetPage,
      limit,
      tab: targetTab,
      targetType
    })

    setLoading(false)
    setReports(response.reports)
    setTotalCount(response.total)
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchData(page, activeTab)
  }, [page, limit, activeTab, isMounted, targetType])

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
          <KunLoading hint="正在获取举报数据..." />
        ) : reports.length ? (
          <>
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onHandled={() => fetchData(page, activeTab)}
              />
            ))}
          </>
        ) : (
          <p className="text-default-500">
            {activeTab === 'pending' ? '暂无未处理举报' : '暂无已处理举报'}
          </p>
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
