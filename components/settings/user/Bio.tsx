'use client'

import { useShallow } from 'zustand/react/shallow'
import { Card, CardBody, CardFooter, CardHeader } from '@heroui/card'
import { Textarea } from '@heroui/input'
import { Button } from '@heroui/button'
import { useUserStore } from '~/store/userStore'
import { useState } from 'react'
import { kunFetchPost } from '~/utils/kunFetch'
import { bioSchema } from '~/validations/user'
import toast from 'react-hot-toast'

export const Bio = () => {
  const { user, setUser } = useUserStore(
    useShallow((state) => ({ user: state.user, setUser: state.setUser }))
  )
  const [bio, setBio] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    const result = bioSchema.safeParse({ bio })
    if (!result.success) {
      setError(result.error.errors[0].message)
    } else {
      setError('')
      setUser({ ...user, bio })
      setLoading(true)

      await kunFetchPost<KunResponse<{}>>('/user/setting/bio', { bio })

      setLoading(false)
      toast.success('更新签名成功')
      setBio('')
    }
  }

  return (
    <Card className="w-full text-sm">
      <CardHeader>
        <h2 className="text-xl font-medium">签名</h2>
      </CardHeader>
      <CardBody className="py-0 space-y-4">
        <div>
          <p>这是您的签名设置, 您的签名将会被显示在您的主页上</p>
        </div>
        <Textarea
          label="签名"
          autoComplete="text"
          defaultValue={user.bio}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          isInvalid={!!error}
          errorMessage={error}
        />
      </CardBody>

      <CardFooter className="flex-wrap">
        <p className="text-default-500">签名最大长度为 107, 可以是任意字符</p>

        <Button
          color="primary"
          variant="solid"
          className="ml-auto"
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
