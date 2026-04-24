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
  '/admin/comment': '评论管理',
  '/admin/creator': '创作者管理',
  '/admin/galgame': 'Galgame 管理',
  '/admin/log': '管理日志',
  '/admin': '管理页面',
  '/admin/resource': '下载资源管理',
  '/admin/setting': '管理系统设置',
  '/admin/user': '用户管理',
  '/admin/resource-apply': '资源首次发布申请',
  '/admin/feedback': 'Gal 反馈管理',
  '/admin/report': '评论举报管理',
  '/admin/rating-report': '评价举报管理',
  '/admin/email': '邮件群发',
  '/apply': '创作者申请',
  '/apply/pending': '正在申请中',
  '/apply/success': '申请成功',
  '/auth/forgot': '忘记密码',
  '/comment': '评论',
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
