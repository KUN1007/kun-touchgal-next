'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, CardBody, CardFooter, CardHeader } from '@heroui/card'
import { Input } from '@heroui/input'
import { Button } from '@heroui/button'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from '@heroui/modal'
import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { EmailVerification } from '~/components/kun/verification-code/Code'
import { resetEmailSchema } from '~/validations/user'
import { kunFetchGet, kunFetchPost } from '~/utils/kunFetch'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import toast from 'react-hot-toast'

type EmailFormData = z.infer<typeof resetEmailSchema>
type AuthMode = 'password' | 'totp'

export const Email = () => {
  const [loading, setLoading] = useState(false)
  const [checkingAuthMode, setCheckingAuthMode] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('password')
  const { isOpen, onOpen, onClose } = useDisclosure()

  const {
    control,
    formState: { errors },
    handleSubmit,
    watch,
    setValue,
    reset
  } = useForm<EmailFormData>({
    resolver: zodResolver(resetEmailSchema),
    defaultValues: {
      email: '',
      code: '',
      currentPassword: '',
      totp: ''
    }
  })

  const closeAuthModal = () => {
    setValue('currentPassword', '')
    setValue('totp', '')
    onClose()
  }

  const openAuthModal = async () => {
    setCheckingAuthMode(true)

    try {
      const response = await kunFetchGet<{
        enabled: boolean
        hasSecret: boolean
      }>('/user/setting/2fa/status')

      setAuthMode(response.enabled && response.hasSecret ? 'totp' : 'password')
      onOpen()
    } catch {
      toast.error('读取 2FA 状态失败, 请稍后重试')
    } finally {
      setCheckingAuthMode(false)
    }
  }

  const handleUpdateEmail = async (data: EmailFormData) => {
    setLoading(true)

    const res = await kunFetchPost<KunResponse<{}>>('/user/setting/email', data)
    kunErrorHandler(res, () => {
      reset()
      onClose()
      toast.success('更新邮箱成功!')
    })

    setLoading(false)
  }

  return (
    <>
      <Card className="w-full text-sm">
        <form>
          <CardHeader>
            <h2 className="text-xl font-medium">邮箱</h2>
          </CardHeader>
          <CardBody className="overflow-visible py-0 space-y-4">
            <div>
              <p>这是您的邮箱设置, 您的邮箱将会被用于恢复您的密码</p>
              <p>
                点击发送验证码, 您的新邮箱中将会收到一封包含验证码的邮件,
                请填写新邮箱中收到的验证码
              </p>
              <p>保存前还需要确认是您本人操作。</p>
            </div>
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  type="email"
                  placeholder="请输入您的新邮箱"
                  startContent={
                    <Mail className="text-2xl pointer-events-none shrink-0 text-default-400" />
                  }
                  isInvalid={!!errors.email}
                  errorMessage={errors.email?.message}
                />
              )}
            />
            <Controller
              name="code"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  type="text"
                  placeholder="新邮箱验证码"
                  startContent={
                    <KeyRound className="text-2xl pointer-events-none shrink-0 text-default-400" />
                  }
                  endContent={
                    <EmailVerification
                      username=""
                      email={watch().email}
                      type="email"
                    />
                  }
                  isInvalid={!!errors.code}
                  errorMessage={errors.code?.message}
                />
              )}
            />
          </CardBody>
          <CardFooter className="flex-wrap">
            <p className="text-default-500">
              如果您的新邮箱未收到验证码, 请检查垃圾邮件或者全部邮件
            </p>
            <Button
              color="primary"
              variant="solid"
              className="ml-auto"
              isLoading={checkingAuthMode}
              isDisabled={loading}
              onPress={() => handleSubmit(openAuthModal)()}
            >
              保存
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Modal isOpen={isOpen} onClose={closeAuthModal} placement="center">
        <ModalContent>
          <ModalHeader>确认修改邮箱</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-500">
              {authMode === 'totp'
                ? '请输入 2FA 验证码以确认是您本人操作。'
                : '请输入当前密码以确认是您本人操作。'}
            </p>
            {authMode === 'totp' ? (
              <Controller
                name="totp"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    placeholder="请输入 2FA 验证码"
                    startContent={
                      <ShieldCheck className="text-2xl pointer-events-none shrink-0 text-default-400" />
                    }
                    isInvalid={!!errors.totp}
                    errorMessage={errors.totp?.message}
                  />
                )}
              />
            ) : (
              <Controller
                name="currentPassword"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    type="password"
                    autoComplete="current-password"
                    placeholder="请输入当前密码"
                    startContent={
                      <KeyRound className="text-2xl pointer-events-none shrink-0 text-default-400" />
                    }
                    isInvalid={!!errors.currentPassword}
                    errorMessage={errors.currentPassword?.message}
                  />
                )}
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={closeAuthModal}>
              取消
            </Button>
            <Button
              color="primary"
              isLoading={loading}
              onPress={() => handleSubmit(handleUpdateEmail)()}
            >
              确认修改
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
