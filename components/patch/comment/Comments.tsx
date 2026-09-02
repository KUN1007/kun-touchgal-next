'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardBody } from '@heroui/card'
import { Button } from '@heroui/button'
import { Pagination } from '@heroui/pagination'
import { Divider } from '@heroui/divider'
import { Chip } from '@heroui/chip'
import { Tooltip } from '@heroui/tooltip'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import { MessageCircle, PenLine } from 'lucide-react'
import { kunFetchGet } from '~/utils/kunFetch'
import { KunTimeAgo } from '~/components/kun/TimeAgo'
import { PublishComment } from './PublishComment'
import { CommentLikeButton } from './CommentLike'
import { CommentDropdown } from './CommentDropdown'
import { removeComment } from './removeComment'
import { CommentContent } from './CommentContent'
import { useUserStore } from '~/store/userStore'
import { KunNull } from '~/components/kun/Null'
import type { PatchComment, PatchCommentResponse } from '~/types/api/patch'

interface Props {
  id: number
  resourceId?: number
}

const COMMENTS_PER_PAGE = 30

export const Comments = ({ id, resourceId }: Props) => {
  const searchParams = useSearchParams()
  const [comments, setComments] = useState<PatchComment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [replyTo, setReplyTo] = useState<{
    commentId: number
    username: string
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [highlightedCommentId, setHighlightedCommentId] = useState<
    number | null
  >(null)
  const [targetCommentResolved, setTargetCommentResolved] = useState(false)
  const user = useUserStore((state) => state.user)
  const requestIdRef = useRef(0)
  const targetCommentId = useMemo(() => {
    const rawCommentId = searchParams.get('commentId')
    if (!rawCommentId) {
      return null
    }

    const parsedCommentId = Number(rawCommentId)
    return Number.isSafeInteger(parsedCommentId) && parsedCommentId > 0
      ? parsedCommentId
      : null
  }, [searchParams])

  const fetchComments = async (
    pageNum: number,
    locateCommentId?: number | null
  ) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    const res = await kunFetchGet<PatchCommentResponse>('/patch/comment', {
      patchId: Number(id),
      ...(resourceId ? { resourceId } : {}),
      page: pageNum,
      limit: COMMENTS_PER_PAGE,
      ...(locateCommentId ? { commentId: locateCommentId } : {})
    })
    if (requestId !== requestIdRef.current) {
      return
    }
    if (res && typeof res !== 'string') {
      setComments(res.comments)
      setTotal(res.total)
      if (res.currentPage !== pageNum) {
        setPage(res.currentPage)
      }
    }
    if (locateCommentId) {
      setTargetCommentResolved(true)
    }
    setLoading(false)
  }

  useEffect(() => {
    setTargetCommentResolved(false)
  }, [targetCommentId, id])

  useEffect(() => {
    if (!user.uid) {
      return
    }
    fetchComments(
      page,
      targetCommentId && !targetCommentResolved ? targetCommentId : null
    )
  }, [page, user.uid, targetCommentId, targetCommentResolved])

  useEffect(() => {
    if (loading || !targetCommentId) {
      return
    }

    const targetElement = document.getElementById(`comment-${targetCommentId}`)
    if (!targetElement) {
      setHighlightedCommentId(null)
      return
    }

    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedCommentId(targetCommentId)

    const timer = window.setTimeout(() => {
      setHighlightedCommentId((current) =>
        current === targetCommentId ? null : current
      )
    }, 3000)

    return () => window.clearTimeout(timer)
  }, [comments, loading, targetCommentId])

  const handleNewComment = async (newComment: PatchComment) => {
    if (newComment.parentId === null) {
      setComments((prev) => [newComment, ...prev])
      setTotal((prev) => prev + 1)
    } else {
      setComments((prev) =>
        prev.map((comment) => {
          if (comment.id === newComment.parentId) {
            return {
              ...comment,
              reply: [...comment.reply, newComment]
            }
          }
          return comment
        })
      )
    }
    setReplyTo(null)
  }

  const handleDeletedComment = (deleted: PatchComment) => {
    setComments((prev) => removeComment(prev, deleted.id))
    if (deleted.parentId !== null) {
      return
    }
    setTotal((prev) => Math.max(0, prev - 1))
    // 删掉的是本页最后一条根评论且不在首页: 退回上一页由 page effect 重新拉取,
    // 否则 totalPages 降到 1 后分页控件整体隐藏, 用户困在空页
    if (page > 1 && comments.length === 1) {
      setPage(page - 1)
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!user.uid) {
    return <KunNull message="请登录后查看评论" />
  }

  const totalPages = Math.ceil(total / COMMENTS_PER_PAGE)

  return (
    <div className="space-y-4">
      {showEditor ? (
        <PublishComment
          patchId={id}
          resourceId={resourceId}
          receiverUsername={null}
          setNewComment={(newComment) => {
            handleNewComment(newComment)
            setShowEditor(false)
          }}
          onCancel={() => setShowEditor(false)}
        />
      ) : (
        <div className="flex justify-end">
          <Button
            color="primary"
            variant="flat"
            startContent={<PenLine className="size-4" />}
            onPress={() => setShowEditor(true)}
          >
            发布评论
          </Button>
        </div>
      )}

      {loading && <KunNull message="加载中..." />}

      {!loading &&
        comments.map((comment) => (
          <Card
            key={comment.id}
            id={`comment-${comment.id}`}
            className={
              highlightedCommentId === comment.id
                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                : undefined
            }
          >
            <CardBody className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <KunUser
                      user={comment.user}
                      userProps={{
                        name: comment.user.name,
                        description: <KunTimeAgo date={comment.created} />,
                        avatarProps: {
                          showFallback: true,
                          name: comment.user.name,
                          src: comment.user.avatar
                        }
                      }}
                    />
                    {comment.status === 1 && (
                      <Tooltip content="审核中，仅你和管理员可见">
                        <Chip color="warning" variant="flat" size="sm">
                          待审核
                        </Chip>
                      </Tooltip>
                    )}
                  </div>
                  <CommentDropdown
                    comment={comment}
                    setComments={setComments}
                    onDeleted={handleDeletedComment}
                  />
                </div>

                <CommentContent comment={comment} />

                <div className="flex gap-2">
                  <CommentLikeButton
                    comment={comment}
                    isDisabled={comment.status === 1}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    isDisabled={comment.status === 1}
                    onPress={() =>
                      setReplyTo(
                        replyTo?.commentId === comment.id
                          ? null
                          : {
                              commentId: comment.id,
                              username: comment.user.name
                            }
                      )
                    }
                  >
                    <MessageCircle className="size-4" />
                    回复
                  </Button>
                </div>
              </div>

              {comment.reply.length > 0 && (
                <>
                  <Divider />
                  <div className="space-y-4 pl-4">
                    {comment.reply.map((reply) => (
                      <div
                        key={reply.id}
                        id={`comment-${reply.id}`}
                        className={
                          highlightedCommentId === reply.id
                            ? 'space-y-2 rounded-large ring-2 ring-primary ring-offset-2 ring-offset-background'
                            : 'space-y-2'
                        }
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <KunUser
                              user={reply.user}
                              userProps={{
                                name: reply.user.name,
                                description: reply.replyToUser ? (
                                  <>
                                    回复了 @{reply.replyToUser.name} ·{' '}
                                    <KunTimeAgo date={reply.created} />
                                  </>
                                ) : (
                                  <KunTimeAgo date={reply.created} />
                                ),
                                avatarProps: {
                                  showFallback: true,
                                  name: reply.user.name,
                                  src: reply.user.avatar,
                                  size: 'sm'
                                }
                              }}
                            />
                            {reply.status === 1 && (
                              <Tooltip content="审核中，仅你和管理员可见">
                                <Chip color="warning" variant="flat" size="sm">
                                  待审核
                                </Chip>
                              </Tooltip>
                            )}
                          </div>
                          <CommentDropdown
                            comment={reply}
                            setComments={setComments}
                            onDeleted={handleDeletedComment}
                          />
                        </div>

                        <CommentContent comment={reply} />

                        <div className="flex gap-2">
                          <CommentLikeButton
                            comment={reply}
                            isDisabled={reply.status === 1}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            isDisabled={reply.status === 1}
                            onPress={() =>
                              setReplyTo(
                                replyTo?.commentId === reply.id
                                  ? null
                                  : {
                                      commentId: reply.id,
                                      username: reply.user.name
                                    }
                              )
                            }
                          >
                            <MessageCircle className="size-4" />
                            回复
                          </Button>
                        </div>

                        {replyTo?.commentId === reply.id && (
                          <div className="mt-2">
                            <PublishComment
                              patchId={id}
                              resourceId={resourceId}
                              parentId={reply.id}
                              receiverUsername={replyTo.username}
                              onSuccess={() => setReplyTo(null)}
                              setNewComment={(newComment) => {
                                handleNewComment({
                                  ...newComment,
                                  parentId: comment.id,
                                  replyToUser: reply.user
                                })
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {replyTo?.commentId === comment.id && (
                <div className="mt-2 pl-4">
                  <PublishComment
                    patchId={id}
                    resourceId={resourceId}
                    parentId={comment.id}
                    receiverUsername={replyTo.username}
                    onSuccess={() => setReplyTo(null)}
                    setNewComment={handleNewComment}
                  />
                </div>
              )}
            </CardBody>
          </Card>
        ))}

      {!loading && comments.length === 0 && (
        <KunNull message="暂无评论，来发表第一条评论吧" />
      )}

      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <Pagination
            total={totalPages}
            page={page}
            onChange={handlePageChange}
            showControls
            isDisabled={loading}
          />
        </div>
      )}
    </div>
  )
}
