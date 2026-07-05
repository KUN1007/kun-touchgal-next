'use client'

import { Card, CardBody, CardFooter, CardHeader } from '@heroui/card'
import { AvatarCrop } from './AvatarCrop'

export const UserAvatar = () => {
  return (
    <Card className="w-full overflow-hidden rounded-[22px] border border-default-200/60 bg-background text-sm shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:bg-content1 dark:shadow-[0_12px_32px_rgba(0,0,0,0.15)]">
      <CardHeader className="flex-col items-start gap-1 px-5 pb-0 pt-5">
        <h2 className="text-xl font-semibold text-foreground">头像</h2>
        <p className="max-w-2xl leading-6 text-default-500">
          用于个人主页、评论和消息中的身份识别。
        </p>
      </CardHeader>

      <CardBody className="flex flex-col gap-5 overflow-visible px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="font-medium text-foreground">上传新的头像图片</p>
          <p className="leading-6 text-default-500">
            点击头像选择图片，裁剪后会立即用于站内展示。
          </p>
        </div>

        <AvatarCrop />
      </CardBody>

      <CardFooter className="border-t border-default-100 bg-default-50/60 px-5 py-4 text-default-500 dark:bg-default-100/10">
        <p className="leading-6">
          头像不是必须，但清晰头像能让其他用户更容易认出您。
        </p>
      </CardFooter>
    </Card>
  )
}
