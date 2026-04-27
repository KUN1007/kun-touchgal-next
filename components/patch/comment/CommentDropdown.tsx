'use client'

import { SetStateAction, useState } from 'react'
import { Button } from '@heroui/button'
import { Dropdown, DropdownMenu, DropdownTrigger } from '@heroui/dropdown'
import { MoreHorizontal, Pencil, Trash2, TriangleAlert } from 'lucide-react'
import { DropdownItem } from '@heroui/dropdown'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@heroui/modal'
import { Textarea } from '@heroui/input'
import { KunMarkdownEditor } from '~/components/kun/editor/MarkdownEditor'
import {
  kunFetchDelete,
  kunFetchGet,
  kunFetchPost,
  kunFetchPut
} from '~/utils/kunFetch'
import toast from 'react-hot-toast'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { useUserStore } from '~/store/userStore'
import { convert } from 'html-to-text'
import type { PatchComment } from '~/types/api/patch'

interface Props {
  comment: PatchComment
  setComments: (comments: SetStateAction<PatchComment[]>) => void
}

export const CommentDropdown = ({ comment, setComments }: Props) => {
  const { user } = useUserStore((state) => state)

  const [editContent, setEditContent] = useState('')
  const [updating, setUpdating] = useState(false)
  const {
    isOpen: isOpenEdit,
    onOpen: onOpenEdit,
    onClose: onCloseEdit
  } = useDisclosure()
  const handleStartEdit = async () => {
    const res = await kunFetchGet<KunResponse<{ content: string }>>(
      '/patch/comment/markdown',
      { commentId: comment.id }
    )
    if (typeof res === 'string') {
      toast.error(res)
      return
    } else {
      setEditContent(res.content)
      onOpenEdit()
    }
  }
  const handleUpdateComment = async (commentId: number) => {
    if (!editContent.trim()) {
      toast.error('评论内容不可为空')
      return
    }

    setUpdating(true)
    const res = await kunFetchPut<KunResponse<PatchComment>>('/patch/comment', {
      commentId,
      content: editContent.trim()
    })
    kunErrorHandler(res, () => {
      setEditContent('')
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId
            ? { ...comment, content: editContent }
            : comment
        )
      )
      onCloseEdit()
      toast.success('更新评论成功!')
    })

    setUpdating(false)
  }

  const {
    isOpen: isOpenDelete,
    onOpen: onOpenDelete,
    onClose: onCloseDelete
  } = useDisclosure()
  const [deleting, setDeleting] = useState(false)
  const handleDeleteComment = async () => {
    setDeleting(true)
    const res = await kunFetchDelete<KunResponse<{}>>('/patch/comment', {
      commentId: comment.id
    })
    kunErrorHandler(res, () => {
      onCloseDelete()
      setComments((prev) => prev.filter((com) => com.id !== comment.id))
      toast.success('评论删除成功')
    })
    setDeleting(false)
  }

  const {
    isOpen: isOpenReport,
    onOpen: onOpenReport,
    onClose: onCloseReport
  } = useDisclosure()
  const [reportValue, setReportValue] = useState('')
  const [reporting, setReporting] = useState(false)
  const handleSubmitReport = async () => {
    setReporting(true)
    const res = await kunFetchPost<KunResponse<{}>>('/patch/comment/report', {
      commentId: comment.id,
      patchId: comment.patchId,
      content: reportValue
    })
    if (typeof res === 'string') {
      toast.error(res)
    } else {
      setReportValue('')
      toast.success('提交举报成功')
    }
    onCloseReport()
    setReporting(false)
  }

  return (
    <>
      <Dropdown>
        <DropdownTrigger>
          <Button variant="light" isIconOnly className="text-default-400">
            <MoreHorizontal aria-label="Galgame 评论操作" className="size-4" />
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Comment actions"
          disabledKeys={
            user.uid !== comment.userId && user.role < 3
              ? ['edit', 'delete']
              : ['report']
          }
        >
          <DropdownItem
            key="edit"
            color="default"
            startContent={<Pencil className="size-4" />}
            onPress={handleStartEdit}
          >
            编辑评论
          </DropdownItem>
          <DropdownItem
            key="delete"
            className="text-danger"
            color="danger"
            startContent={<Trash2 className="size-4" />}
            onPress={onOpenDelete}
          >
            删除评论
          </DropdownItem>
          <DropdownItem
            key="report"
            startContent={<TriangleAlert className="size-4" />}
            onPress={onOpenReport}
          >
            举报评论
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>

      <Modal isOpen={isOpenEdit} onClose={onCloseEdit} size="2xl">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            重新编辑评论
          </ModalHeader>
          <ModalBody>
            <KunMarkdownEditor
              value={editContent}
              onChange={setEditContent}
              minHeight={160}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCloseEdit}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={() => handleUpdateComment(comment.id)}
              isDisabled={updating}
              isLoading={updating}
            >
              保存
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isOpenDelete} onClose={onCloseDelete} placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">删除评论</ModalHeader>
          <ModalBody>
            <p>
              您确定要删除这条评论吗, 这将会删除该评论,
              以及所有回复该评论的评论, 该操作不可撤销
            </p>
            <p className="pl-4 border-l-4 border-primary-500">
              {convert(comment.content)}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCloseDelete}>
              取消
            </Button>
            <Button
              color="danger"
              onPress={handleDeleteComment}
              disabled={deleting}
              isLoading={deleting}
            >
              删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isOpenReport} onClose={onCloseReport}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">举报评论</ModalHeader>
          <ModalBody>
            <Textarea
              label={`举报 ${convert(comment.content).slice(0, 20)}`}
              isRequired
              placeholder="请填写举报原因"
              value={reportValue}
              onChange={(e) => setReportValue(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCloseReport}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={handleSubmitReport}
              isDisabled={reporting}
              isLoading={reporting}
            >
              提交
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
