'use client'

import Link from 'next/link'
import {
  BadgeCheck,
  Box,
  Edit,
  FileClock,
  Gamepad2,
  KeyRound,
  Mail,
  MessageCircleQuestion,
  MessageSquare,
  Puzzle,
  Scale,
  Settings,
  ShieldCheck,
  Star,
  TriangleAlert,
  Users
} from 'lucide-react'

const menuGroups = [
  {
    label: '内容审核',
    items: [
      {
        name: 'AI 审核管理',
        href: '/admin/moderation',
        icon: ShieldCheck
      },
      {
        name: '评论举报管理',
        href: '/admin/report',
        icon: TriangleAlert
      },
      {
        name: '评价举报管理',
        href: '/admin/rating-report',
        icon: TriangleAlert
      },
      {
        name: '申诉管理',
        href: '/admin/appeal',
        icon: Scale
      },
      {
        name: 'Gal 反馈管理',
        href: '/admin/feedback',
        icon: MessageCircleQuestion
      }
    ]
  },
  {
    label: '用户与创作者',
    items: [
      {
        name: '用户管理',
        href: '/admin/user',
        icon: Users
      },
      {
        name: '创作者申请',
        href: '/admin/creator',
        icon: BadgeCheck
      }
    ]
  },
  {
    label: '资源与作品',
    items: [
      {
        name: '发布 Galgame',
        href: '/edit/create',
        icon: Edit
      },
      {
        name: 'Gal 管理',
        href: '/admin/galgame',
        icon: Gamepad2
      },
      {
        name: '下载资源管理',
        href: '/admin/resource',
        icon: Puzzle
      },
      {
        name: '首次资源发布申请',
        href: '/admin/resource-apply',
        icon: Box
      },
      {
        name: '评论管理',
        href: '/admin/comment',
        icon: MessageSquare
      },
      {
        name: '评价管理',
        href: '/admin/rating',
        icon: Star
      }
    ]
  },
  {
    label: '系统',
    items: [
      {
        name: '管理日志',
        href: '/admin/log',
        icon: FileClock
      },
      {
        name: 'OIDC 应用',
        href: '/admin/oidc',
        icon: KeyRound
      },
      {
        name: '网站设置',
        href: '/admin/setting',
        icon: Settings
      },
      {
        name: '邮件群发',
        href: '/admin/email',
        icon: Mail
      }
    ]
  }
]

export const SidebarContent = ({ pathname }: { pathname: string }) => {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto p-4 pl-0">
      {menuGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-4 text-xs font-semibold text-default-600">
            {group.label}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-medium px-4 py-2 transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-default-100'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
