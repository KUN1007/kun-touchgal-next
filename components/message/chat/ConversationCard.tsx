import Link from 'next/link'
import { Card, CardBody } from '@heroui/card'
import { Chip } from '@heroui/chip'
import { KunTimeAgo } from '~/components/kun/TimeAgo'
import { KunAvatar } from '~/components/kun/floating-card/KunAvatar'
import type { Conversation } from '~/types/api/conversation'

interface Props {
  conversation: Conversation
}

export const ConversationCard = ({ conversation }: Props) => {
  return (
    <Card
      isPressable
      as={Link}
      href={`/message/chat/${conversation.id}`}
      className="w-full border border-default-100 dark:border-default-200"
    >
      <CardBody className="flex flex-row items-center gap-4">
        <KunAvatar
          uid={conversation.otherUser.id}
          avatarProps={{
            src: conversation.otherUser.avatar,
            name: conversation.otherUser.name
          }}
        />

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold truncate">
              {conversation.otherUser.name}
            </span>
            <span className="text-xs text-default-400 shrink-0 ml-2">
              <KunTimeAgo date={conversation.lastMessageTime} />
            </span>
          </div>
          <p className="text-sm text-default-600 truncate">
            {conversation.lastMessage || '暂无消息'}
          </p>
        </div>

        {conversation.unreadCount > 0 && (
          <Chip color="danger" size="sm" variant="solid">
            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
          </Chip>
        )}
      </CardBody>
    </Card>
  )
}
