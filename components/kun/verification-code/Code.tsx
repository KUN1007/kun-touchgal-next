'use client'

import { useState } from 'react'
import { Button } from '@heroui/button'
import { KunCaptchaModal } from '~/components/kun/auth/CaptchaModal'
import toast from 'react-hot-toast'
import { kunFetchPost } from '~/utils/kunFetch'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { useDisclosure } from '@heroui/modal'

interface Props {
  username: string
  email: string
  type: 'register' | 'email'
}

export const EmailVerification = ({ username, email, type }: Props) => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)

  const startCountdown = () => {
    setCountdown(60)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleSendCode = async (code: string) => {
    if (!email) {
      toast.error('请输入合法的邮箱格式')
      return
    }
    if (type === 'register' && !username) {
      toast.error('用户名不可为空')
      return
    }
    setLoading(true)

    try {
      const res =
        type === 'register'
          ? await kunFetchPost<KunResponse<{}>>('/auth/send-register-code', {
              name: username,
              email,
              captcha: code
            })
          : await kunFetchPost<KunResponse<{}>>(
              '/user/setting/send-reset-email-code',
              { email, captcha: code }
            )

      kunErrorHandler(res, () => {
        toast.success('发送成功, 验证码已发送到您的邮箱')
        startCountdown()
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCaptchaSuccess = async (code: string) => {
    onClose()
    await handleSendCode(code)
  }

  return (
    <>
      <Button
        onPress={onOpen}
        isDisabled={countdown > 0 || loading}
        size="sm"
        variant="light"
      >
        {loading
          ? '发送中...'
          : countdown > 0
            ? `${countdown}秒后重试`
            : '发送验证码'}
      </Button>

      <KunCaptchaModal
        isOpen={isOpen}
        onClose={onClose}
        onSuccess={handleCaptchaSuccess}
      />
    </>
  )
}
