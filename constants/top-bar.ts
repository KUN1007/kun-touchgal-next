export interface KunNavItem {
  name: string
  href: string
}

export const kunNavItem: KunNavItem[] = [
  {
    name: '游戏下载',
    href: '/galgame'
  },
  {
    name: '游戏标签',
    href: '/tag'
  },
  {
    name: '游戏会社',
    href: '/company'
  },
  {
    name: '游戏排行',
    href: '/ranking'
  },
  {
    name: '帮助文档',
    href: '/doc'
  }
]

export const kunMobileNavItem: KunNavItem[] = [
  ...kunNavItem,
  {
    name: '评论列表',
    href: '/comment'
  },
  {
    name: '下载资源列表',
    href: '/resource'
  },
  {
    name: '联系我们',
    href: '/doc/notice/feedback'
  }
]
