export interface KunBreadcrumbItem {
  key: string
  label: string
  href: string
  icon?: string
}

export const keyLabelMap: Record<string, string> = {
  '/': '主页',
  '/doc': '帮助文档',
  '/company': '游戏会社',
  '/company/[id]': '会社详情',
  '/apply': '创作者申请',
  '/apply/pending': '正在申请中',
  '/apply/success': '申请成功',
  '/auth/forgot': '忘记密码',
  '/edit/create': '创建 Galgame',
  '/galgame': 'Galgame',
  '/login': '登录',
  '/message/follow': '关注消息',
  '/message/notice': '通知消息',
  '/message/chat': '私聊消息',
  '/message/system': '系统消息',
  '/message/mention': 'AT消息',
  '/register': '注册',
  '/resource': '资源下载',
  '/search': '搜索',
  '/settings/user': '用户设置',
  '/tag': '游戏标签',
  '/tag/[id]': '标签详情',
  '/user/[id]/comment': '用户评论',
  '/user/[id]/favorite': '用户收藏',
  '/user/[id]/rating': '用户评价',
  '/user/[id]/resource': '用户资源',
  '/auth/email-notice': '退订邮件通知',
  '/login/2fa': '两步验证',
  '/message/chat/[conversationId]': '私聊消息'
}

export const dynamicRoutes = ['patch', 'tag', 'user']
