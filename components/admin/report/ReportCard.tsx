'use client'

import { useState } from 'react'
import {
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
  useDisclosure
} from '@heroui/react'
import { KunAvatar } from '~/components/kun/floating-card/KunAvatar'
import { formatDate } from '~/utils/time'
import { ReportHandler } from './ReportHandler'
import {
  KUN_GALGAME_RATING_PLAY_STATUS_MAP,
  KUN_GALGAME_RATING_RECOMMEND_MAP
} from '~/constants/galgame'
import { kunFetchPost } from '~/utils/kunFetch'
import toast from 'react-hot-toast'
import { convert } from 'html-to-text'
import type { AdminReport } from '~/types/api/admin'

interface Props {
  report: AdminReport
  onHandled: () => void
}

const buildTargetPreview = (report: AdminReport) => {
  if (report.targetType === 'comment' && report.comment) {
    return convert(report.comment.content).slice(0, 300)
  }
  if (report.targetType === 'rating' && report.rating) {
    const summary = report.rating.shortSummary.trim()
    if (summary) {
      return summary.slice(0, 300)
    }
    return `总分 ${report.rating.overall}/10，${KUN_GALGAME_RATING_RECOMMEND_MAP[report.rating.recommend]}，${KUN_GALGAME_RATING_PLAY_STATUS_MAP[report.rating.playStatus]}`
  }
  return '被举报内容已删除或不存在'
}

export const ReportCard = ({ report, onHandled }: Props) => {
  const [reportStatus, setReportStatus] = useState(report.status)
  const [handleContent, setHandleContent] = useState('')
  const [actionType, setActionType] = useState<'delete' | 'reject'>('delete')
  const [updating, setUpdating] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()

  const openActionModal = (action: 'delete' | 'reject') => {
    setActionType(action)
    setHandleContent('')
    onOpen()
  }

  const handleUpdateReport = async () => {
    setUpdating(true)
    const res = await kunFetchPost<KunResponse<{}>>('/admin/report/handle', {
      reportId: report.id,
      action: actionType,
      content: handleContent.trim()
    })
    if (typeof res === 'string') {
      toast.error(res)
    } else {
      setReportStatus(actionType === 'reject' ? 3 : 2)
      onClose()
      setHandleContent('')
      toast.success(actionType === 'reject' ? '驳回举报成功!' : '处理举报成功!')
      onHandled()
    }
    setUpdating(false)
  }

  const statusColor: 'success' | 'danger' | 'warning' =
    reportStatus === 0 ? 'danger' : reportStatus === 3 ? 'warning' : 'success'
  const statusLabel =
    reportStatus === 0 ? '未处理' : reportStatus === 3 ? '已驳回' : '已处理'

  const targetLabel = report.targetType === 'rating' ? '评价' : '评论'
  const targetPreview = buildTargetPreview(report)
  const reportedUser = report.reportedUser

  return (
    <>
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-1 gap-3">
              <KunAvatar
                uid={report.sender.id}
                avatarProps={{
                  name: report.sender.name,
                  src: report.sender.avatar
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2">
                  <Chip size="sm" variant="flat" color="primary">
                    举报人
                  </Chip>
                  <span className="font-semibold">{report.sender.name}</span>
                  <span className="text-small text-default-500">
                    {formatDate(report.created, {
                      isPrecise: true,
                      isShowYear: true
                    })}
                  </span>
                  <Chip size="sm" color={statusColor} variant="flat">
                    {statusLabel}
                  </Chip>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-small">
                  <span className="text-default-500">举报原因：</span>
                  {report.reason}
                </p>
              </div>
            </div>
            <ReportHandler report={report} />
          </div>

          <Divider />

          <div className="flex items-start gap-3">
            {reportedUser ? (
              <KunAvatar
                uid={reportedUser.id}
                avatarProps={{
                  name: reportedUser.name,
                  src: reportedUser.avatar
                }}
              />
            ) : null}
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <Chip size="sm" variant="flat" color="danger">
                  被举报{targetLabel}
                </Chip>
                <span className="font-semibold">
                  {reportedUser ? reportedUser.name : '未知用户'}
                </span>
                <span className="text-small text-default-500">
                  于「{report.patch.name}」
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-small text-default-700">
                {targetPreview}
              </p>
            </div>
          </div>

          {reportStatus !== 0 && report.handlerReply ? (
            <>
              <Divider />
              <div className="text-small text-default-600">
                <span className="font-semibold">
                  {reportStatus === 3 ? '驳回回复：' : '处理回复：'}
                </span>
                {report.handlerReply}
                {report.handler ? (
                  <span className="ml-2 text-default-400">
                    by {report.handler.name}
                  </span>
                ) : null}
              </div>
            </>
          ) : null}

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              color="danger"
              variant="flat"
              onPress={() => openActionModal('delete')}
              isDisabled={reportStatus !== 0}
            >
              删除并处理
            </Button>
            <Button
              size="sm"
              color="warning"
              variant="flat"
              onPress={() => openActionModal('reject')}
              isDisabled={reportStatus !== 0}
            >
              驳回
            </Button>
            <span className="text-tiny text-default-400">
              操作会自动处理同一{targetLabel}的其他待处理举报
            </span>
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            {actionType === 'reject' ? '驳回举报' : '处理举报'}
          </ModalHeader>
          <ModalBody>
            <Textarea
              value={handleContent}
              label="反馈回复内容 (可选)"
              onChange={(e) => setHandleContent(e.target.value)}
              placeholder={
                actionType === 'reject'
                  ? '留空将使用默认回复：已驳回'
                  : '留空将使用默认回复：已处理'
              }
              minRows={2}
              maxRows={8}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => {
                setHandleContent('')
                onClose()
              }}
            >
              取消
            </Button>
            <Button
              color={actionType === 'reject' ? 'warning' : 'danger'}
              onPress={handleUpdateReport}
              isDisabled={updating}
              isLoading={updating}
            >
              {actionType === 'reject' ? '确认驳回' : '确认删除'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
