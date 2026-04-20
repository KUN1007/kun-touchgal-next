'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Input, useDisclosure } from '@heroui/react'
import { User } from 'lucide-react'
import { kunFetchPost } from '~/utils/kunFetch'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import toast from 'react-hot-toast'
import { stepOneSchema } from '~/validations/forgot'
import { KunCaptchaModal } from '~/components/kun/auth/CaptchaModal'

type StepOneFormData = z.infer<typeof stepOneSchema>

interface Props {
  setStep: (step: number) => void
  setEmail: (username: string) => void
}

export const StepOne = ({ setStep, setEmail }: Props) => {
  const [loading, setLoading] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()

  const { control, watch, trigger } = useForm<StepOneFormData>({
    resolver: zodResolver(stepOneSchema),
    defaultValues: {
      name: '',
      captcha: ''
    }
  })

  const handleCaptchaSuccess = async (code: string) => {
    onClose()
    setLoading(true)

    const data = watch()
    const res = await kunFetchPost<KunResponse<undefined>>('/forgot/one', {
      name: data.name,
      captcha: code
    })
    kunErrorHandler(res, () => {
      setEmail(data.name)
      setStep(2)
      toast.success('重置验证码发送成功!')
    })

    setLoading(false)
  }

  const handleOpenCaptcha = async () => {
    setLoading(true)
    const valid = await trigger('name')
    setLoading(false)
    if (valid) {
      onOpen()
    }
  }

  return (
    <form className="w-full space-y-4">
      <Controller
        name="name"
        control={control}
        render={({ field, formState: { errors } }) => (
          <Input
            {...field}
            label="邮箱或用户名"
            placeholder="请输入您的邮箱或用户名"
            autoComplete="email"
            isInvalid={!!errors.name}
            errorMessage={errors.name?.message}
            startContent={<User className="size-4 text-default-400" />}
          />
        )}
      />
      <Button
        color="primary"
        className="w-full"
        isLoading={loading}
        isDisabled={loading || isOpen}
        onPress={handleOpenCaptcha}
      >
        发送验证码
      </Button>

      <KunCaptchaModal
        isOpen={isOpen}
        onClose={onClose}
        onSuccess={handleCaptchaSuccess}
      />
    </form>
  )
}
