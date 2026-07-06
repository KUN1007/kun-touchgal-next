'use client'

import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Select,
  SelectItem
} from '@heroui/react'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@heroui/modal'
import { useEffect, useState, type Key } from 'react'
import toast from 'react-hot-toast'
import { kunFetchDelete, kunFetchGet, kunFetchPost } from '~/utils/kunFetch'
import { KunLoading } from '~/components/kun/Loading'
import { KunPagination } from '~/components/kun/Pagination'
import { useMounted } from '~/hooks/useMounted'
import { ModerationTaskCard } from './Card'
import { MODERATION_TASK_STATUS_MAP } from '~/constants/moderation'
import type {
  AdminModerationBlacklistItem,
  AdminModerationStats,
  AdminModerationTask
} from '~/types/api/admin'

const statusFilterOptions = [
  { key: 'all', label: '全部' },
  ...Object.entries(MODERATION_TASK_STATUS_MAP).map(([key, label]) => ({
    key,
    label
  }))
]

interface Props {
  initialTasks: AdminModerationTask[]
  initialTotal: number
}

export const Moderation = ({ initialTasks, initialTotal }: Props) => {
  const [tasks, setTasks] = useState<AdminModerationTask[]>(initialTasks)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<AdminModerationStats | null>(null)
  const limit = 30
  const isMounted = useMounted()

  const {
    isOpen: isOpenBlacklist,
    onOpen: onOpenBlacklist,
    onClose: onCloseBlacklist
  } = useDisclosure()
  const [blacklist, setBlacklist] = useState<AdminModerationBlacklistItem[]>([])
  const [blacklistPattern, setBlacklistPattern] = useState('')
  const [blacklistLoading, setBlacklistLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await kunFetchGet<{
        tasks: AdminModerationTask[]
        total: number
      }>('/admin/moderation', { page, limit, status })
      setTasks(response.tasks)
      setTotal(response.total)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    const res = await kunFetchGet<KunResponse<AdminModerationStats>>(
      '/admin/moderation/stats',
      {}
    )
    if (typeof res !== 'string') {
      setStats(res)
    }
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchData()
  }, [page, status])

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchBlacklist = async () => {
    const res = await kunFetchGet<
      KunResponse<{ items: AdminModerationBlacklistItem[] }>
    >('/admin/moderation/blacklist', {})
    if (typeof res === 'string') {
      toast.error(res)
    } else {
      setBlacklist(res.items)
    }
  }

  const handleOpenBlacklist = async (pattern = '') => {
    setBlacklistPattern(pattern)
    onOpenBlacklist()
    await fetchBlacklist()
  }

  const handleAddBlacklist = async () => {
    if (!blacklistPattern.trim()) {
      return
    }
    setBlacklistLoading(true)
    try {
      const res = await kunFetchPost<KunResponse<{}>>(
        '/admin/moderation/blacklist',
        { pattern: blacklistPattern.trim() }
      )
      if (typeof res === 'string') {
        toast.error(res)
        return
      }
      toast.success('已加入黑名单')
      setBlacklistPattern('')
      await fetchBlacklist()
    } finally {
      setBlacklistLoading(false)
    }
  }

  const handleDeleteBlacklist = async (blacklistId: number) => {
    const res = await kunFetchDelete<KunResponse<{}>>(
      '/admin/moderation/blacklist',
      { blacklistId }
    )
    if (typeof res === 'string') {
      toast.error(res)
      return
    }
    toast.success('已删除黑名单模式')
    await fetchBlacklist()
  }

  const handleStatusChange = (keys: 'all' | Set<Key>) => {
    const key = Array.from(keys)[0] as string | undefined
    if (!key) {
      return
    }
    setStatus(key)
    setPage(1)
  }

  if (!isMounted) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">AI 审核管理</h1>
        <KunLoading hint="正在获取审核任务..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">AI 审核管理</h1>

      {stats && (
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span>今日送审: {stats.todayTotal}</span>
              <span className="text-default-500">近 30 天:</span>
              {Object.entries(MODERATION_TASK_STATUS_MAP).map(
                ([key, label]) => (
                  <span key={key}>
                    {label}: {stats.statusCounts[key] ?? 0}
                  </span>
                )
              )}
              <span>
                Token 消耗: {stats.tokensIn} 入 / {stats.tokensOut} 出
              </span>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          aria-label="任务状态筛选"
          className="w-full sm:max-w-40"
          selectedKeys={new Set([status])}
          onSelectionChange={handleStatusChange}
        >
          {statusFilterOptions.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>
        <Button variant="flat" onPress={() => handleOpenBlacklist()}>
          黑名单管理
        </Button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <KunLoading hint="正在获取审核任务..." />
        ) : tasks.length ? (
          tasks.map((task) => (
            <ModerationTaskCard
              key={task.id}
              task={task}
              onRefresh={() => {
                fetchData()
                fetchStats()
              }}
              onAddBlacklist={handleOpenBlacklist}
            />
          ))
        ) : (
          <div className="py-12 text-center text-default-500">暂无审核任务</div>
        )}
      </div>

      <div className="flex justify-center">
        <KunPagination
          total={Math.max(1, Math.ceil(total / limit))}
          page={page}
          onPageChange={setPage}
          isLoading={loading}
        />
      </div>

      <Modal
        isOpen={isOpenBlacklist}
        onClose={onCloseBlacklist}
        placement="center"
        size="2xl"
      >
        <ModalContent>
          <ModalHeader>审核黑名单管理</ModalHeader>
          <ModalBody className="space-y-4">
            <p className="text-sm text-default-500">
              黑名单为子串匹配（忽略大小写与空白），命中即直接拒绝且不消耗
              Token，请只添加高置信度的违规特征
            </p>
            <div className="flex gap-2">
              <Input
                fullWidth
                placeholder="输入黑名单模式"
                value={blacklistPattern}
                onValueChange={setBlacklistPattern}
              />
              <Button
                color="primary"
                isLoading={blacklistLoading}
                onPress={handleAddBlacklist}
              >
                添加
              </Button>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {blacklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-default-100 p-2"
                >
                  <span className="break-all text-sm">{item.pattern}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Chip size="sm" variant="flat">
                      {item.user.name}
                    </Chip>
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      onPress={() => handleDeleteBlacklist(item.id)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              ))}
              {!blacklist.length && (
                <p className="py-4 text-center text-sm text-default-500">
                  暂无黑名单模式
                </p>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCloseBlacklist}>
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
