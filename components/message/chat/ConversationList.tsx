'use client'

import { useEffect, useState } from 'react'
import { useMounted } from '~/hooks/useMounted'
import { KunLoading } from '~/components/kun/Loading'
import { KunNull } from '~/components/kun/Null'
import { KunPagination } from '~/components/kun/Pagination'
import { ConversationCard } from './ConversationCard'
import { kunFetchGet } from '~/utils/kunFetch'
import toast from 'react-hot-toast'
import { useMessageStore } from '~/store/messageStore'
import type { Conversation } from '~/types/api/conversation'

interface Props {
  initialConversations: Conversation[]
  total: number
}

export const ConversationList = ({ initialConversations, total }: Props) => {
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const isMounted = useMounted()
  const setHasUnreadConversation = useMessageStore(
    (state) => state.setHasUnreadConversation
  )

  const syncConversationUnreadStatus = (items: Conversation[]) => {
    setHasUnreadConversation(items.some((conv) => conv.unreadCount > 0))
  }

  const fetchConversations = async () => {
    setLoading(true)

    const response = await kunFetchGet<
      KunResponse<{
        conversations: Conversation[]
        total: number
      }>
    >('/message/conversation', {
      page,
      limit: 30
    })
    if (typeof response === 'string') {
      toast.error(response)
    } else {
      setConversations(response.conversations)
      syncConversationUnreadStatus(response.conversations)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!isMounted) {
      return
    }
    fetchConversations()
  }, [page])

  useEffect(() => {
    syncConversationUnreadStatus(initialConversations)
  }, [initialConversations])

  return (
    <div className="space-y-4">
      {loading ? (
        <KunLoading hint="正在获取会话列表..." />
      ) : conversations.length === 0 ? (
        <KunNull message="暂无私聊会话，您可以在其他用户的主页发起私聊" />
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => (
            <ConversationCard key={conv.id} conversation={conv} />
          ))}
        </div>
      )}

      {total > 30 && (
        <div className="flex justify-center">
          <KunPagination
            total={Math.ceil(total / 30)}
            page={page}
            onPageChange={setPage}
            isLoading={loading}
          />
        </div>
      )}
    </div>
  )
}
