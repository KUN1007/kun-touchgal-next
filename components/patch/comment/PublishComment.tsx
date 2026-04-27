'use client'

import { useState } from 'react'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Button } from '@heroui/button'
import { Send } from 'lucide-react'
import { kunFetchPost } from '~/utils/kunFetch'
import toast from 'react-hot-toast'
import { useUserStore } from '~/store/userStore'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { KunAvatar } from '~/components/kun/floating-card/KunAvatar'
import { KunMarkdownEditor } from '~/components/kun/editor/MarkdownEditor'
import type { PatchComment } from '~/types/api/patch'

interface CreateCommentProps {
  patchId: number
  receiverUsername: string | null | undefined
  parentId?: number | null
  setNewComment: (newComment: PatchComment) => void
  onSuccess?: () => void
  onCancel?: () => void
}

export const PublishComment = ({
  patchId,
  parentId = null,
  receiverUsername = null,
  setNewComment,
  onSuccess,
  onCancel
}: CreateCommentProps) => {
  const [loading, setLoading] = useState(false)
  const { user } = useUserStore((state) => state)
  const [content, setContent] = useState('')

  const handlePublishComment = async () => {
    setLoading(true)
    const res = await kunFetchPost<KunResponse<PatchComment>>(
      '/patch/comment',
      {
        patchId,
        parentId,
        content: content.trim()
      }
    )
    kunErrorHandler(res, (value) => {
      setNewComment({
        ...value,
        user: { id: user.uid, name: user.name, avatar: user.avatar }
      })
      toast.success('评论发布成功')
      setContent('')
      onSuccess?.()
    })

    setLoading(false)
  }

  return (
    <Card>
      <CardHeader className="pb-0 space-x-4">
        <KunAvatar
          uid={user.uid}
          avatarProps={{
            showFallback: true,
            name: user.name,
            src: user.avatar
          }}
        />
        <div className="flex flex-col">
          <span className="font-semibold">{user.name}</span>
          {receiverUsername && (
            <span className="text-sm">回复 @{receiverUsername}</span>
          )}
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <KunMarkdownEditor
          value={content}
          onChange={setContent}
          minHeight={180}
        />

        <div className="flex items-center justify-between">
          <div />

          <div className="flex gap-2">
            {onCancel && (
              <Button variant="flat" onPress={onCancel}>
                取消
              </Button>
            )}
            <Button
              color="primary"
              startContent={<Send className="size-4" />}
              isDisabled={!content.trim() || loading}
              isLoading={loading}
              onPress={handlePublishComment}
            >
              发布评论
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
