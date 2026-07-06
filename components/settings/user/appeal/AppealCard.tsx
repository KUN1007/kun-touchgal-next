'use client'

import { useState } from 'react'
import { Button } from '@heroui/button'
import { Chip } from '@heroui/chip'
import { Input, Textarea } from '@heroui/input'
import toast from 'react-hot-toast'
import { kunFetchPost } from '~/utils/kunFetch'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { KunTimeAgo } from '~/components/kun/TimeAgo'
import { MODERATION_CONTENT_TYPE_MAP } from '~/constants/moderation'
import type { UserAppealItem, UserAppealState } from '~/types/api/appeal'

interface Props {
  item: UserAppealItem
  onRefresh: () => void
}

const stateChipMap: Record<
  UserAppealState,
  {
    label: string
    color: 'warning' | 'primary' | 'success' | 'danger' | 'default'
  }
> = {
  appealable: { label: '可申诉', color: 'warning' },
  pending: { label: '申诉待处理', color: 'primary' },
  approved: { label: '申诉已通过', color: 'success' },
  rejected: { label: '申诉已拒绝', color: 'danger' },
  unavailable: { label: '已失效', color: 'default' }
}

export const AppealCard = ({ item, onRefresh }: Props) => {
  const [text, setText] = useState(item.original?.text ?? '')
  const [name, setName] = useState(item.original?.name ?? '')
  const [note, setNote] = useState(item.original?.note ?? '')
  const [submitting, setSubmitting] = useState(false)

  const isResource = item.contentType === 'resource'
  // 申诉只能提交一次, 仅未申诉的内容可编辑; 提交后进入只读展示
  const editable = item.state === 'appealable'
  const stateChip = stateChipMap[item.state]

  const handleSubmit = async () => {
    if (!isResource && !text.trim()) {
      toast.error('申诉内容不可为空')
      return
    }

    const body = isResource
      ? { contentType: 'resource', taskId: item.taskId, name, note }
      : item.contentType === 'comment'
        ? { contentType: 'comment', taskId: item.taskId, content: text }
        : { contentType: 'rating', taskId: item.taskId, shortSummary: text }

    setSubmitting(true)
    const res = await kunFetchPost<KunResponse<{}>>('/user/appeal', body)
    setSubmitting(false)
    kunErrorHandler(res, () => {
      toast.success('申诉已提交, 请等待管理员复核')
      onRefresh()
    })
  }

  return (
    <div className="space-y-3 rounded-2xl border border-default-200/60 bg-default-50/60 p-4 dark:bg-default-100/10">
      <div className="flex flex-wrap items-center gap-2">
        <Chip size="sm" variant="flat">
          {MODERATION_CONTENT_TYPE_MAP[item.contentType]}
        </Chip>
        <Chip size="sm" variant="flat" color={stateChip.color}>
          {stateChip.label}
        </Chip>
        {item.patchName && (
          <span className="text-sm text-default-500">{item.patchName}</span>
        )}
        {item.rejectedAt && (
          <span className="ml-auto text-sm text-default-400">
            <KunTimeAgo date={item.rejectedAt} />
          </span>
        )}
      </div>

      <p className="text-sm text-danger-500">
        未通过原因：{item.rejectReason || '包含违规内容'}
      </p>

      {item.original ? (
        <div className="space-y-1 text-sm">
          <p className="text-default-500">原内容：</p>
          <div className="whitespace-pre-wrap break-all rounded-lg bg-default-100 p-2 text-default-600">
            {isResource
              ? `标题：${item.original.name}\n介绍：${item.original.note}`
              : item.original.text}
          </div>
        </div>
      ) : (
        <p className="text-sm text-default-400">内容已被删除</p>
      )}

      {editable && (
        <div className="space-y-3">
          {isResource ? (
            <>
              <Input
                label="资源标题"
                value={name}
                onValueChange={setName}
                maxLength={300}
              />
              <Textarea
                label="资源介绍"
                value={note}
                onValueChange={setNote}
                maxLength={10007}
              />
            </>
          ) : (
            <Textarea
              label={item.contentType === 'comment' ? '评论内容' : '评价内容'}
              value={text}
              onValueChange={setText}
              maxLength={item.contentType === 'comment' ? 10007 : 1314}
            />
          )}

          <div className="flex flex-col items-end gap-2">
            <p className="text-xs text-default-400">
              申诉提交后不可修改，请确认内容无误后再提交。
            </p>
            <Button
              color="primary"
              size="sm"
              onPress={handleSubmit}
              isLoading={submitting}
            >
              提交申诉
            </Button>
          </div>
        </div>
      )}

      {!editable && item.appeal && (
        <div className="space-y-1 text-sm">
          <p className="text-default-500">申诉提交的内容：</p>
          <div className="whitespace-pre-wrap break-all rounded-lg bg-default-100 p-2 text-default-600">
            {isResource
              ? `标题：${item.appeal.payload.name}\n介绍：${item.appeal.payload.note}`
              : item.appeal.payload.text}
          </div>
        </div>
      )}
    </div>
  )
}
