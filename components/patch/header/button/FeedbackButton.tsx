'use client'

import { lazy, Suspense, useState } from 'react'
import { Button } from '@heroui/button'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader
} from '@heroui/modal'
import { MessageCircleQuestion } from 'lucide-react'
import type { Patch } from '~/types/api/patch'

const FeedbackDialog = lazy(() => import('./FeedbackDialog'))

interface FeedbackDialogContentFallbackProps {
  patchName: string
  inputValue: string
  onInputChange: (value: string) => void
  onClose: () => void
}

const FeedbackDialogContentFallback = ({
  patchName,
  inputValue,
  onInputChange,
  onClose
}: FeedbackDialogContentFallbackProps) => {
  return (
    <>
      <ModalBody>
        <label
          className="block text-sm text-foreground"
          htmlFor="feedback-fallback"
        >
          游戏 {patchName} 的反馈 <span className="text-danger">*</span>
        </label>
        <textarea
          id="feedback-fallback"
          className="min-h-32 w-full resize-none rounded-medium border border-default-200 bg-default-100 px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
          placeholder="请填写反馈内容 (游戏错误, 资源失效, 游戏介绍错误等等, 请尽可能详细并指明具体的位置)"
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="light" onPress={onClose}>
          取消
        </Button>
        <Button color="primary">提交</Button>
      </ModalFooter>
    </>
  )
}

const preloadFeedbackDialog = () => {
  void import('./FeedbackDialog')
}

interface Props {
  patch: Patch
}

export const FeedbackButton = ({ patch }: Props) => {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')

  return (
    <>
      <Button
        variant="bordered"
        isIconOnly
        aria-label="游戏反馈"
        title="游戏反馈"
        onPress={() => setIsOpen(true)}
        onPointerEnter={preloadFeedbackDialog}
        onFocus={preloadFeedbackDialog}
        size="sm"
      >
        <MessageCircleQuestion className="size-4" />
      </Button>

      {isOpen && (
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
          <ModalContent>
            <ModalHeader className="flex flex-col gap-1">
              提交 Galgame 反馈
            </ModalHeader>
            <Suspense
              fallback={
                <FeedbackDialogContentFallback
                  patchName={patch.name}
                  inputValue={inputValue}
                  onInputChange={setInputValue}
                  onClose={() => setIsOpen(false)}
                />
              }
            >
              <FeedbackDialog
                patchId={patch.id}
                patchName={patch.name}
                inputValue={inputValue}
                onInputChange={setInputValue}
                onSubmitSuccess={() => setInputValue('')}
                onClose={() => setIsOpen(false)}
              />
            </Suspense>
          </ModalContent>
        </Modal>
      )}
    </>
  )
}
