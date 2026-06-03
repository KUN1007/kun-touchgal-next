'use client'

import { Card, CardBody, CardFooter } from '@heroui/card'
import { AvatarCrop } from './AvatarCrop'

export const UserAvatar = () => {
  return (
    <Card className="w-full text-sm">
      <CardBody className="flex flex-row items-center justify-between gap-4 overflow-visible pb-0">
        <div>
          <h2 className="mb-4 text-xl font-medium">头像</h2>
          <p>这是您的头像设置</p>
          <p>您可以点击头像以上传图片文件</p>
        </div>

        <AvatarCrop />
      </CardBody>

      <CardFooter>
        <p className="py-2 text-default-500">
          头像不是必须, 但是我们强烈推荐设置头像
        </p>
      </CardFooter>
    </Card>
  )
}
