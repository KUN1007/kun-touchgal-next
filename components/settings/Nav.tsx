'use client'

import {
  Bell,
  EyeOff,
  MessageSquareWarning,
  ShieldCheck,
  UserRound
} from 'lucide-react'
import { cn } from '~/utils/cn'

export const userSettingsNavItems = [
  {
    id: 'profile',
    title: '个人资料',
    icon: UserRound
  },
  {
    id: 'security',
    title: '账号安全',
    icon: ShieldCheck
  },
  {
    id: 'notification-privacy',
    title: '通知与隐私',
    icon: Bell
  },
  {
    id: 'content-control',
    title: '内容控制',
    icon: EyeOff
  },
  {
    id: 'appeal',
    title: '内容申诉',
    icon: MessageSquareWarning
  }
] as const

export type UserSettingsSectionId = (typeof userSettingsNavItems)[number]['id']

interface SettingsNavProps {
  activeId: UserSettingsSectionId
  onSelect: (id: UserSettingsSectionId) => void
}

const getPanelId = (id: UserSettingsSectionId) => `${id}-settings-panel`
const getTabId = (id: UserSettingsSectionId) => `${id}-settings-tab`

interface SettingsTabKeyEvent {
  key: string
  preventDefault: () => void
  currentTarget: HTMLButtonElement
}

export const SettingsNav = ({ activeId, onSelect }: SettingsNavProps) => {
  const handleKeyDown = (event: SettingsTabKeyEvent, index: number) => {
    const lastIndex = userSettingsNavItems.length - 1
    let nextIndex = index

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = index === lastIndex ? 0 : index + 1
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = index === 0 ? lastIndex : index - 1
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = lastIndex
    } else {
      return
    }

    event.preventDefault()
    const nextId = userSettingsNavItems[nextIndex].id
    onSelect(nextId)
    document.getElementById(getTabId(nextId))?.focus()
  }

  return (
    <aside className="min-w-0 lg:sticky lg:top-24">
      <nav
        aria-label="账户设置分类"
        className="min-w-0 rounded-[22px] border border-default-200/60 bg-background p-2 shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:bg-content1 dark:shadow-[0_12px_32px_rgba(0,0,0,0.15)]"
      >
        <ul
          role="tablist"
          className="grid min-w-0 grid-cols-2 gap-2 lg:block lg:space-y-1"
        >
          {userSettingsNavItems.map((item, index) => {
            const isActive = activeId === item.id
            const Icon = item.icon

            return (
              <li key={item.id} role="presentation">
                <button
                  id={getTabId(item.id)}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={getPanelId(item.id)}
                  onClick={() => onSelect(item.id)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  tabIndex={isActive ? 0 : -1}
                  className={cn(
                    'group flex min-h-12 w-full items-center gap-2 rounded-2xl px-3 text-left text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-medium'
                      : 'text-default-600 hover:bg-default-100 hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200',
                      isActive
                        ? 'bg-primary-foreground/15 text-primary-foreground'
                        : 'bg-default-100 text-default-500 group-hover:text-primary'
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="truncate">{item.title}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
