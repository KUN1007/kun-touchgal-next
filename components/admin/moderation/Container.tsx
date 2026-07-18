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
import { KunCardSkeleton } from '~/components/kun/CardSkeleton'
import { KunPagination } from '~/components/kun/Pagination'
import { useMounted } from '~/hooks/useMounted'
import { ModerationTaskCard } from './Card'
import {
  formatModerationContentTypeLabel,
  MODERATION_CONTENT_TYPE_MAP,
  MODERATION_TASK_STATUS_MAP,
  MODERATION_TEXT_CONTENT_TYPE
} from '~/constants/moderation'
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
  const [error, setError] = useState('')
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
  const [blacklistTypes, setBlacklistTypes] = useState<string[]>([])
  const [blacklistLoading, setBlacklistLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await kunFetchGet<
        KunResponse<{
          tasks: AdminModerationTask[]
          total: number
        }>
      >('/admin/moderation', { page, limit, status })
      if (typeof response === 'string') {
        setError(response)
        return
      }
      setTasks(response.tasks)
      setTotal(response.total)
    } catch {
      setError('网络错误, 请稍后重试')
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
    setBlacklistTypes([])
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
        { pattern: blacklistPattern.trim(), contentTypes: blacklistTypes }
      )
      if (typeof res === 'string') {
        toast.error(res)
        return
      }
      toast.success('已加入黑名单')
      setBlacklistPattern('')
      setBlacklistTypes([])
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
        <KunCardSkeleton count={3} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">AI 审核管理</h1>

      {stats && (
        <Card>
          <CardBody className="space-y-3">
            <p className="text-sm text-default-500">
              审核统计, 状态与 Token 为近 30 天
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <div>
                <p className="text-sm text-default-500">今日送审</p>
                <p className="text-xl font-semibold">{stats.todayTotal}</p>
              </div>
              {Object.entries(MODERATION_TASK_STATUS_MAP).map(
                ([key, label]) => (
                  <div key={key}>
                    <p className="text-sm text-default-500">{label}</p>
                    <p className="text-xl font-semibold">
                      {stats.statusCounts[key] ?? 0}
                    </p>
                  </div>
                )
              )}
              <div>
                <p className="text-sm text-default-500">Token 入</p>
                <p className="text-xl font-semibold">{stats.tokensIn}</p>
              </div>
              <div>
                <p className="text-sm text-default-500">Token 出</p>
                <p className="text-xl font-semibold">{stats.tokensOut}</p>
              </div>
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
          <KunCardSkeleton count={3} />
        ) : error ? (
          <div className="space-y-3 py-12 text-center">
            <p className="text-danger">{error}</p>
            <Button variant="flat" onPress={() => fetchData()}>
              重试
            </Button>
          </div>
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
          <div className="space-y-1 py-12 text-center">
            <p className="text-default-600">暂无审核任务</p>
            <p className="text-sm text-default-500">
              送审内容会自动进入审核队列, 可切换上方状态筛选查看其他任务
            </p>
          </div>
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
              Token，请只添加高置信度的违规特征。可选择生效类型，不选则对全部类型生效
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                fullWidth
                placeholder="输入黑名单模式"
                value={blacklistPattern}
                onValueChange={setBlacklistPattern}
              />
              <Select
                aria-label="生效类型"
                selectionMode="multiple"
                placeholder="全部类型"
                className="sm:max-w-44"
                selectedKeys={new Set(blacklistTypes)}
                // 多选模式下 Cmd/Ctrl+A 全选会发出字面量 'all' 而非 Set
                onSelectionChange={(keys) =>
                  setBlacklistTypes(
                    keys === 'all'
                      ? [...MODERATION_TEXT_CONTENT_TYPE]
                      : (Array.from(keys) as string[])
                  )
                }
              >
                {MODERATION_TEXT_CONTENT_TYPE.map((type) => (
                  <SelectItem key={type}>
                    {MODERATION_CONTENT_TYPE_MAP[type]}
                  </SelectItem>
                ))}
              </Select>
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
                    <Chip size="sm" variant="flat" color="primary">
                      {formatModerationContentTypeLabel(item.contentTypes)}
                    </Chip>
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
                  暂无黑名单模式, 在上方输入高置信度的违规特征,
                  或在任务卡片点击「加入黑名单」快速添加
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
