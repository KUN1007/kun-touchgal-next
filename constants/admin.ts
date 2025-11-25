import type { OverviewData } from '~/types/api/admin'

export const APPLICANT_STATUS_MAP: Record<number, string> = {
  0: '待处理',
  1: '已读',
  2: '已通过',
  3: '已拒绝'
}

export const RESOURCE_STATUS_MAP: Record<number, string> = {
  0: '正常',
  1: '封禁',
  2: '待审核'
}

export const ADMIN_LOG_TYPE_MAP: Record<string, string> = {
  create: '创建',
  delete: '删除',
  approve: '通过',
  decline: '拒绝',
  update: '更新'
}

export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/wmv', 'video/webm']

export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.wmv', '.webm']

export const ADMIN_STATS_MAP: Record<keyof OverviewData, string> = {
  newUser: '新注册用户',
  newActiveUser: '新活跃用户',
  newGalgame: '新收录 Galgame',
  newGalgameResource: '新上传 Gal 资源',
  newComment: '新评论'
}

export const ADMIN_STATS_SUM_MAP: Record<string, string> = {
  userCount: '用户总数',
  galgameCount: 'Galgame 数量',
  galgameResourceCount: 'Galgame 资源数量',
  galgamePatchResourceCount: 'Galgame 补丁总数',
  galgameCommentCount: '评论总数'
}
