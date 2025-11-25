import Link from 'next/link'
import { Card, CardBody } from '@heroui/card'
import { Avatar } from '@heroui/avatar'
import { Chip } from '@heroui/chip'
import { formatTimeDifference } from '~/utils/time'
import {
  AtSign,
  Bell,
  GitPullRequestArrow,
  Heart,
  Mail,
  MessageCircle,
  MonitorCog,
  ThumbsUp,
  Users
} from 'lucide-react'
import { MESSAGE_TYPE_MAP } from '~/constants/message'
import { KunAvatar } from '~/components/kun/floating-card/KunAvatar'
import type { Message } from '~/types/api/message'

interface Props {
  msg: Message
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'system':
      return <MonitorCog className="size-5 text-secondary-500" />
    case 'pm':
      return <Mail className="size-5 text-secondary-500" />
    case 'like':
      return <ThumbsUp className="size-5 text-secondary-500" />
    case 'favorite':
      return <Heart className="size-5 text-danger-500" />
    case 'comment':
      return <MessageCircle className="size-5 text-primary-500" />
    case 'pr':
      return <GitPullRequestArrow className="size-5 text-success-500" />
    case 'follow':
      return <Users className="size-5 text-success-500" />
    case 'mention':
      return <AtSign className="size-5 text-success-500" />
    default:
      return <Bell className="size-5 text-default-500" />
  }
}

const getCardRoute = (msg: Message) => {
  if (!msg.sender) {
    return '/'
  }
  if (!msg.link) {
    return `/user/${msg.sender.id}/resource`
  }
  return msg.link
}

export const MessageCard = ({ msg }: Props) => {
  const href = getCardRoute(msg)

  return (
    <Card
      isPressable
      as={Link}
      href={href}
      className="w-full border border-default-100 dark:border-default-200"
    >
      <CardBody className="flex flex-row items-center gap-4">
        {msg.sender ? (
          <KunAvatar
            uid={msg.sender.id}
            avatarProps={{
              src: msg.sender.avatar,
              name: msg.sender.name
            }}
          />
        ) : (
          <Avatar src="/favicon.webp" name="系统消息" />
        )}

        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            {getNotificationIcon(msg.type)}

            <span className="font-semibold">
              {msg.sender ? msg.sender.name : '系统'}
            </span>

            <span>{MESSAGE_TYPE_MAP[msg.type]}</span>
          </div>
          <p className="text-default-600">{msg.content}</p>
          <span className="text-sm text-default-400">
            {formatTimeDifference(msg.created)}
          </span>
        </div>
        {msg.status === 0 ? (
          <Chip color="danger" size="sm">
            新消息
          </Chip>
        ) : (
          <Chip color="default" size="sm">
            已阅读
          </Chip>
        )}
      </CardBody>
    </Card>
  )
}
