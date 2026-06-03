'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, CardBody, CardFooter, CardHeader } from '@heroui/card'
import { Input } from '@heroui/input'
import { Button } from '@heroui/button'
import { Divider } from '@heroui/divider'
import { Link } from '@heroui/link'
import { useRouter } from '@bprogress/next'
import toast from 'react-hot-toast'
import { passwordSchema } from '~/validations/user'
import { kunFetchPost } from '~/utils/kunFetch'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { useUserStore } from '~/store/userStore'
type PasswordFormData = z.infer<typeof passwordSchema>

export const Password = () => {
  const router = useRouter()
  const logout = useUserStore((state) => state.logout)
  const [loading, setLoading] = useState(false)

  const {
    control,
    watch,
    formState: { errors },
    reset
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: ''
    }
  })

  const handleUpdatePassword = async () => {
    setLoading(true)

    const res = await kunFetchPost<KunResponse<{}>>(
      '/user/setting/password',
      watch()
    )
    kunErrorHandler(res, () => {
      reset()
      logout()
      toast.success('更改密码成功, 请使用新密码重新登录')
      router.push('/login')
    })

    setLoading(false)
  }

  return (
    <Card className="w-full text-sm">
      <form>
        <CardHeader>
          <h2 className="text-xl font-medium">密码</h2>
        </CardHeader>
        <CardBody className="overflow-visible py-0 space-y-4">
          <div>
            <p>这是您的密码设置, 您需要输入旧密码以更改新密码</p>
          </div>
          <Controller
            name="oldPassword"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="text"
                label="旧密码"
                autoComplete="old-password"
                isInvalid={!!errors.oldPassword}
                errorMessage={errors.oldPassword?.message}
              />
            )}
          />
          <Controller
            name="newPassword"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type="text"
                label="新密码"
                autoComplete="new-password"
                isInvalid={!!errors.newPassword}
                errorMessage={errors.newPassword?.message}
              />
            )}
          />
        </CardBody>

        <CardFooter className="flex-wrap">
          <p className="text-default-500">
            密码长度最短 6 个字符, 最长 1000 个字符, 可以选择性的包含
            @!#$%^&*()_-+=\/ 等特殊字符, 至少包含数字和英语字母
          </p>
          <Button
            color="primary"
            variant="solid"
            className="ml-auto"
            isLoading={loading}
            onPress={handleUpdatePassword}
          >
            保存
          </Button>
        </CardFooter>

        <Divider />

        <CardFooter>
          <Link showAnchorIcon href="/auth/forgot">
            忘记密码?
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
