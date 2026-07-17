'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { kunFetchGet } from '~/utils/kunFetch'
import { useInstance } from '@milkdown/react'
import { editorViewCtx } from '@milkdown/kit/core'
import { usePluginViewContext } from '@prosemirror-adapter/react'
import { slashFactory, SlashProvider } from '@milkdown/kit/plugin/slash'
import toast from 'react-hot-toast'
import { useDebounce } from 'use-debounce'
import { linkSchema } from '@milkdown/preset-commonmark'
import { KunMentionUserList } from '~/components/kun/MentionUserList'
import { cn } from '~/utils/cn'
import type { Ctx } from '@milkdown/kit/ctx'

export const slash = slashFactory('Commands')

export const MentionsListDropdown = () => {
  const ref = useRef<HTMLDivElement>(null)
  const slashProvider = useRef<SlashProvider>(null)
  const [users, setUsers] = useState<KunUser[]>([])
  const [isPending, startTransition] = useTransition()

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 500)

  const { view, prevState } = usePluginViewContext()
  const [loading, get] = useInstance()
  const action = useCallback(
    (fn: (ctx: Ctx) => void) => {
      if (loading) return
      get().action(fn)
    },
    [loading]
  )

  useEffect(() => {
    if (!view) {
      return
    }

    const currentTextBlockContent = slashProvider.current?.getContent(view)
    const lastAtIndex = currentTextBlockContent?.lastIndexOf('@') ?? -1

    if (
      lastAtIndex >= 0 &&
      currentTextBlockContent &&
      currentTextBlockContent.length
    ) {
      const mentionText = currentTextBlockContent.slice(lastAtIndex + 1)
      setSearchQuery(mentionText)
    }
  }, [view, prevState])

  useEffect(() => {
    const div = ref.current
    if (loading || !div) {
      return
    }
    slashProvider.current = new SlashProvider({
      content: div,
      shouldShow(this: SlashProvider, view) {
        const currentTextBlockContent = this.getContent(view)
        if (!currentTextBlockContent) return false

        const lastAtIndex = currentTextBlockContent.lastIndexOf('@')
        if (lastAtIndex < 0) return false

        const atContent = currentTextBlockContent.slice(lastAtIndex)
        // /\s$/ matches `\u00A0`, `\u3000`, `\u2009` etc. Cannot use endsWith(' ')
        if (/\s/.test(atContent)) {
          return false
        }

        return true
      }
    })

    return () => {
      slashProvider.current?.destroy()
    }
  }, [loading])

  useEffect(() => {
    slashProvider.current?.update(view, prevState)
  })

  const onMentionItemClick = (userId: number) => {
    action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { dispatch, state } = view
      const { from, $from } = state.selection

      const currentContent = $from.node().textContent
      const untilAt = currentContent.lastIndexOf('@')
      const offset = currentContent.length - untilAt
      const user = users.find((u) => u.id === userId)

      if (user?.name) {
        const link = linkSchema
          .type(ctx)
          .create({ href: `/user/${user.id}/comment` })
        const node = state.schema.text(`@${user.name} `).mark([link])

        if (from - offset > 0) {
          const tr = state.tr.replaceWith(from - offset, from, node)
          dispatch(tr)
          view.focus()
        }
      } else {
        toast.error(`用户 ID 为 ${userId} 用户的用户名为空`)
      }
    })
  }

  const fetchUsers = async (queryText: string) => {
    startTransition(async () => {
      const response = await kunFetchGet<KunUser[]>('/user/mention/search', {
        query: queryText
      })
      setUsers(response)
    })
  }
  useEffect(() => {
    if (debouncedQuery.length && !/\s/.test(debouncedQuery)) {
      fetchUsers(debouncedQuery)
    } else {
      setUsers([])
    }
  }, [debouncedQuery])

  return (
    <div
      ref={ref}
      aria-expanded="false"
      className={cn(
        `absolute data-[show='false']:hidden z-10`,
        'w-full px-1 py-2 shadow max-w-64 bg-background border-small rounded-small border-default-200 dark:border-default-100'
      )}
    >
      <KunMentionUserList
        isPending={isPending}
        users={users}
        onSelect={(user) => onMentionItemClick(user.id)}
      />
    </div>
  )
}
