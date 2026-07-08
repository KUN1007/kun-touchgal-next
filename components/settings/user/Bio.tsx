'use client'

import { useShallow } from 'zustand/react/shallow'
import { Card, CardBody, CardFooter, CardHeader } from '@heroui/card'
import { Textarea } from '@heroui/input'
import { Button } from '@heroui/button'
import { useUserStore } from '~/store/userStore'
import { useState } from 'react'
import { kunFetchPost } from '~/utils/kunFetch'
import { kunErrorHandler } from '~/utils/kunErrorHandler'
import { bioSchema } from '~/validations/user'
import toast from 'react-hot-toast'

export const Bio = () => {
  const { user, setUser } = useUserStore(
    useShallow((state) => ({ user: state.user, setUser: state.setUser }))
  )
  const [bio, setBio] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)

  const handleSave = async () => {
    const result = bioSchema.safeParse({ bio })
    if (!result.success) {
      setError(result.error.errors[0].message)
    } else {
      setError('')
      setUser({ ...user, bio })
      setLoading(true)

      const res = await kunFetchPost<KunResponse<{ pending?: boolean }>>(
        '/user/setting/bio',
        { bio }
      )

      setLoading(false)
      kunErrorHandler(res, (value) => {
        toast.success('更新签名成功')
        setBio('')
        setPending(!!value.pending)
      })
    }
  }

  return (
    <Card className="w-full overflow-hidden rounded-[22px] border border-default-200/60 bg-background text-sm shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:bg-content1 dark:shadow-[0_12px_32px_rgba(0,0,0,0.15)]">
      <CardHeader className="flex-col items-start gap-1 px-5 pb-0 pt-5">
        <h2 className="text-xl font-semibold text-foreground">签名</h2>
        <p className="max-w-2xl leading-6 text-default-500">
          签名会显示在您的个人主页，用一句话介绍自己或当前状态。
        </p>
      </CardHeader>
      <CardBody className="space-y-4 overflow-visible px-5 py-4">
        <Textarea
          label="签名"
          autoComplete="text"
          defaultValue={user.bio}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          isInvalid={!!error}
          errorMessage={error}
        />
        {pending && (
          <p className="text-sm text-warning-600 dark:text-warning-500">
            签名审核中，通过后对所有人可见
          </p>
        )}
      </CardBody>

      <CardFooter className="flex flex-col items-start gap-3 border-t border-default-100 bg-default-50/60 px-5 py-4 sm:flex-row sm:items-center dark:bg-default-100/10">
        <p className="min-w-0 flex-1 leading-6 text-default-500">
          签名最大长度为 107，可以是任意字符。
        </p>

        <Button
          color="primary"
          variant="solid"
          className="w-full sm:ml-auto sm:w-auto"
          onPress={handleSave}
          isLoading={loading}
          disabled={loading}
        >
          保存
        </Button>
      </CardFooter>
    </Card>
  )
}
