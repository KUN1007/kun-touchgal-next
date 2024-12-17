'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Card, CardBody, CardFooter, CardHeader } from '@nextui-org/card'
import { KunUser } from '~/components/kun/floating-card/KunUser'
import { Button } from '@nextui-org/button'
import { Textarea } from '@nextui-org/input'
import { Chip } from '@nextui-org/chip'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@nextui-org/modal'
import { Check, X } from 'lucide-react'
import { formatDistanceToNow } from '~/utils/formatDistanceToNow'
import { HighlightedText } from '~/components/patch/DiffContent'
import { kunFetchPut } from '~/utils/kunFetch'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import type { PatchPullRequest as PatchPullRequestType } from '~/types/api/patch'

interface Props {
  pr: PatchPullRequestType[]
}

export const PatchPullRequest = ({ pr }: Props) => {
  const [expandedId, setExpandedId] = useState<number>(-1)

  const handleToggleExpand = (id: number) => {
    setExpandedId((prevId) => (prevId === id ? -1 : id))
  }

  const { isOpen, onOpen, onClose } = useDisclosure()
  const [merging, setMerging] = useState(false)
  const [mergeId, setMergeId] = useState(0)
  const handleMergePR = async () => {
    setMerging(true)
    const res = await kunFetchPut<KunResponse<{}>>('/patch/pr/merge', {
      prId: mergeId
    })
    kunErrorHandler(res, () => {
      toast.success('合并请求成功')
    })
    setMerging(false)
    onClose()
  }

  const [declining, setDeclining] = useState(false)
  const [showDecline, setShowDecline] = useState(false)
  const [note, setNote] = useState('')
  const handleDeclinePR = async (prId: number) => {
    if (!note.trim()) {
      toast.error('请填写拒绝原因')
      return
    }

    setDeclining(true)
    const res = await kunFetchPut<KunResponse<{}>>('/patch/pr/decline', {
      prId,
      note
    })
    kunErrorHandler(res, () => {
      toast.success('拒绝合并成功')
    })
    setDeclining(false)
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-2xl font-medium">更新请求</h2>
      </CardHeader>
      <CardBody>
        <div className="mb-4 text-default-600">
          <p>如果是游戏的发布者或者网站管理员更新了游戏, 更新会立即生效</p>
          <p>
            贡献者提交的更新请求,
            可以由游戏发布者或者管理员同意后合并到游戏信息中
          </p>
        </div>

        <div className="space-y-4">
          {pr.length > 0 &&
            pr.map((p) => (
              <Card key={p.index}>
                <CardHeader className="flex justify-between">
                  <KunUser
                    user={p.user}
                    userProps={{
                      name: p.user.name,
                      description: `${formatDistanceToNow(p.created)} • 提出更新 #${p.index}`,
                      avatarProps: {
                        showFallback: true,
                        src: p.user.avatar,
                        name: p.user.name.charAt(0).toUpperCase()
                      }
                    }}
                  />
                  {!p.status && (
                    <Button
                      color="primary"
                      onClick={() => handleToggleExpand(p.index)}
                    >
                      {expandedId === p.index ? '收起' : '详情'}
                    </Button>
                  )}

                  {p.status === 1 && (
                    <Chip
                      endContent={<Check className="size-4" />}
                      variant="flat"
                      color="success"
                    >
                      已合并
                    </Chip>
                  )}

                  {p.status === 2 && (
                    <Chip
                      endContent={<X className="size-4" />}
                      variant="flat"
                      color="danger"
                    >
                      已拒绝
                    </Chip>
                  )}
                </CardHeader>
                {expandedId === p.index && (
                  <>
                    <CardBody>
                      <HighlightedText content={p.content} />
                    </CardBody>

                    <CardFooter className="flex flex-col w-full space-y-2">
                      <div className="flex justify-end w-full mb-4 space-x-2">
                        <Button
                          color="danger"
                          variant="flat"
                          onClick={() => setShowDecline((prev) => !prev)}
                        >
                          拒绝
                        </Button>
                        <Button
                          color="primary"
                          onClick={() => {
                            onOpen()
                            setMergeId(p.id)
                          }}
                        >
                          合并
                        </Button>
                      </div>
                      {showDecline && (
                        <div className="flex flex-col items-end w-full space-y-2 ">
                          <Textarea
                            labelPlacement="outside"
                            isRequired
                            label="拒绝原因 (最多 1007 字符)"
                            placeholder="您需要填写拒绝合并请求的原因, 以便提出请求者了解拒绝原因"
                            value={note}
                            onValueChange={setNote}
                            className="w-full"
                          />
                          <Button
                            color="danger"
                            onClick={() => handleDeclinePR(p.id)}
                            disabled={declining}
                            isLoading={declining}
                          >
                            确定拒绝
                          </Button>
                        </div>
                      )}
                    </CardFooter>
                  </>
                )}

                {p.status === 2 && <CardFooter>原因: {p.note}</CardFooter>}
              </Card>
            ))}
        </div>
      </CardBody>

      <Modal isOpen={isOpen} onClose={onClose} placement="center">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            合并更新请求
          </ModalHeader>
          <ModalBody>
            <p>
              您确定要合并更新请求吗,
              这将会将更新请求中的更新覆盖到目前的游戏信息上
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              取消
            </Button>
            <Button
              color="danger"
              onPress={handleMergePR}
              disabled={merging}
              isLoading={merging}
            >
              确定
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  )
}
