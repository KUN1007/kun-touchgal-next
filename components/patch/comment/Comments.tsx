'use client'

import { useEffect, useState } from 'react'
import { Card, CardBody } from '@heroui/card'
import { Button } from '@heroui/button'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import { ArrowUpDown, MessageCircle } from 'lucide-react'
import { kunFetchGet } from '~/utils/kunFetch'
import { formatTimeDifference } from '~/utils/time'
import { PublishComment } from './PublishComment'
import { CommentLikeButton } from './CommentLike'
import { CommentDropdown } from './CommentDropdown'
import { CommentContent } from './CommentContent'
import { scrollIntoComment } from './_scrollIntoComment'
import { useUserStore } from '~/store/userStore'
import { KunNull } from '~/components/kun/Null'
import { cn } from '~/utils/cn'
import type { PatchComment } from '~/types/api/patch'

interface Props {
  id: number
}

type SortOrder = 'asc' | 'desc'

export const Comments = ({ id }: Props) => {
  const [comments, setComments] = useState<PatchComment[]>([])
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const user = useUserStore((state) => state.user)

  useEffect(() => {
    if (!user.uid) {
      return
    }

    const fetchData = async () => {
      const res = await kunFetchGet<PatchComment[]>('/patch/comment', {
        patchId: Number(id)
      })
      setComments(res)
    }
    fetchData()
  }, [])

  const sortComments = (commentsToSort: PatchComment[]): PatchComment[] => {
    const sortedComments = [...commentsToSort].sort((a, b) => {
      const dateA = new Date(a.created).getTime()
      const dateB = new Date(b.created).getTime()
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
    })

    return sortedComments.map((comment) => ({
      ...comment,
      reply: comment.reply ? sortComments(comment.reply) : []
    }))
  }

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
  }

  const setNewComment = async (newComment: PatchComment) => {
    setComments((prevComments) => [...prevComments, newComment])
    await new Promise((resolve) => {
      setTimeout(resolve, 500)
    })
    scrollIntoComment(newComment.id)
  }

  if (!user.uid) {
    return <KunNull message="请登陆后查看评论" />
  }

  const renderComments = (comments: PatchComment[], depth = 0) => {
    return comments.map((comment) => (
      <div
        key={comment.id}
        className={cn(depth <= 3 && depth !== 0 ? `ml-4` : 'ml-0', 'space-y-4')}
      >
        <Card id={`comment-${comment.id}`}>
          <CardBody>
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <KunUser
                  user={comment.user}
                  userProps={{
                    name: comment.user.name,
                    description: formatTimeDifference(comment.created),
                    avatarProps: {
                      showFallback: true,
                      name: comment.user.name,
                      src: comment.user.avatar
                    }
                  }}
                />
                <CommentDropdown comment={comment} setComments={setComments} />
              </div>

              <CommentContent comment={comment} />

              <div className="flex gap-2 mt-2">
                <CommentLikeButton comment={comment} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onPress={() =>
                    setReplyTo(replyTo === comment.id ? null : comment.id)
                  }
                >
                  <MessageCircle className="size-4" />
                  回复
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {replyTo === comment.id && (
          <div className="mt-2 ml-8">
            <PublishComment
              patchId={id}
              parentId={comment.id}
              receiverUsername={comment.quotedUsername}
              onSuccess={() => setReplyTo(null)}
              setNewComment={setNewComment}
            />
          </div>
        )}

        {comment.reply && comment.reply.length > 0 && (
          <>{renderComments(comment.reply, depth + 1)}</>
        )}
      </div>
    ))
  }

  const sortedComments = sortComments(comments)

  return (
    <div className="space-y-4">
      <PublishComment
        patchId={id}
        receiverUsername={null}
        setNewComment={setNewComment}
      />

      {!!sortedComments.length && (
        <Card>
          <CardBody className="flex flex-row items-center justify-start gap-2">
            <Button variant="flat" className="gap-2" onPress={toggleSortOrder}>
              <ArrowUpDown className="size-4" />
              {sortOrder === 'asc' ? '最早优先' : '最新优先'}
            </Button>
          </CardBody>
        </Card>
      )}

      {renderComments(sortedComments)}
    </div>
  )
}
