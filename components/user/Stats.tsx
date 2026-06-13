import { Card, CardBody } from '@heroui/card'
import { FileText, MessageCircle, Package, Star } from 'lucide-react'
import type { UserInfo } from '~/types/api/user'

export const UserStats = ({ user }: { user: UserInfo }) => {
  const stats = [
    { label: '评论', value: user._count.patch_comment, icon: MessageCircle },
    { label: '评价', value: user._count.patch_rating, icon: FileText },
    { label: '收藏', value: user._count.patch_favorite, icon: Star },
    {
      label: '发布资源',
      value: user._count.patch_resource,
      icon: Package
    }
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="w-full">
          <CardBody className="flex flex-row items-center gap-4 p-4">
            <stat.icon className="size-8 text-primary" />
            <div>
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-small text-default-500">{stat.label}</p>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
