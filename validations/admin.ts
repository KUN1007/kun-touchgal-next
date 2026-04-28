import { z } from 'zod'
import { kunPasswordRegex } from '~/utils/validate'

export const adminReportTargetTypeSchema = z.enum(['comment', 'rating'])

export const adminPaginationSchema = z.object({
  page: z.coerce.number().min(1).max(9999999),
  limit: z.coerce.number().min(1).max(100),
  search: z
    .string()
    .max(300, { message: '搜索关键词不能超过 300 个字符' })
    .optional()
})

export const adminUserSearchTypeSchema = z.enum(['name', 'email', 'id'])

export const adminUserPaginationSchema = adminPaginationSchema.extend({
  limit: z.coerce.number().min(1).max(500),
  searchType: adminUserSearchTypeSchema.default('name')
})

export const adminCommentSearchTypeSchema = z.enum(['content', 'user'])
const adminCommentDeleteLimit = 30

export const adminCommentPaginationSchema = adminPaginationSchema.extend({
  limit: z.coerce.number().min(1).max(500),
  searchType: adminCommentSearchTypeSchema.default('content'),
  userId: z.coerce.number().min(1).max(9999999).optional()
})

const adminCommentIdsSchema = z
  .string()
  .trim()
  .min(1, { message: '至少选择一条评论' })
  .refine(
    (value) =>
      value.split(',').every((item) => {
        const trimmed = item.trim()
        if (!/^\d+$/.test(trimmed)) {
          return false
        }

        const commentId = Number.parseInt(trimmed, 10)
        return commentId >= 1 && commentId <= 9999999
      }),
    { message: '评论 ID 格式不正确' }
  )
  .transform((value) => [
    ...new Set(
      value
        .split(',')
        .map((item) => Number.parseInt(item.trim(), 10))
        .filter((commentId) => commentId >= 1 && commentId <= 9999999)
    )
  ])
  .refine((commentIds) => commentIds.length <= adminCommentDeleteLimit, {
    message: `单次最多删除 ${adminCommentDeleteLimit} 条评论`
  })

export const adminDeleteCommentSchema = z.union([
  z
    .object({
      commentId: z.coerce
        .number({ message: '评论 ID 必须为数字' })
        .min(1)
        .max(9999999)
    })
    .transform(({ commentId }) => ({
      commentIds: [commentId]
    })),
  z
    .object({
      commentIds: adminCommentIdsSchema
    })
    .transform(({ commentIds }) => ({
      commentIds
    }))
])

export const adminGalgamePaginationSchema = adminPaginationSchema.extend({
  limit: z.coerce.number().min(1).max(500)
})

export const adminFeedbackPaginationSchema = adminPaginationSchema.extend({
  limit: z.coerce.number().min(1).max(500)
})

export const adminResourceApplyPaginationSchema = adminPaginationSchema.extend({
  limit: z.coerce.number().min(1).max(500)
})

export const adminResourcePaginationSchema = adminPaginationSchema.extend({
  limit: z.coerce.number().min(1).max(500),
  userId: z.coerce.number().min(1).max(9999999).optional()
})

export const adminReportPaginationSchema = adminPaginationSchema.extend({
  tab: z.enum(['pending', 'handled']).default('pending'),
  targetType: adminReportTargetTypeSchema.default('comment')
})

export const adminUpdateUserSchema = z.object({
  uid: z.coerce.number().min(1).max(9999999),
  name: z
    .string()
    .trim()
    .min(1, { message: '用户名长度至少为 1 个字符' })
    .max(17, { message: '用户名长度不能超过 17 个字符' }),
  email: z.string().trim().email({ message: '请输入合法的邮箱格式' }),
  role: z.coerce.number().min(1).max(3),
  status: z.coerce.number().min(0).max(2),
  dailyImageCount: z.coerce.number().min(0).max(50),
  password: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value
      }

      const trimmedValue = value.trim()
      return trimmedValue ? trimmedValue : undefined
    },
    z
      .string()
      .regex(kunPasswordRegex, {
        message:
          '新密码格式非法, 密码长度需为 6 到 1007 位, 且至少包含一个英文字符和一个数字'
      })
      .optional()
  ),
  bio: z.string().trim().max(107, { message: '个人简介不能超过 107 个字符' })
})

export const adminDisableUser2FASchema = z.object({
  uid: z.coerce.number({ message: '用户 ID 必须为数字' }).min(1).max(9999999)
})

export const approveCreatorSchema = z.object({
  messageId: z.coerce.number().min(1).max(9999999),
  uid: z.coerce.number().min(1).max(9999999)
})

export const declineCreatorSchema = z.object({
  messageId: z.coerce.number().min(1).max(9999999),
  reason: z
    .string()
    .trim()
    .min(1)
    .max(1007, { message: '拒绝原因不能超过 1007 个字符' })
})

export const adminSendEmailSchema = z.object({
  templateId: z.string(),
  variables: z.record(z.string(), z.string())
})

export const adminHandleFeedbackSchema = z.object({
  messageId: z.coerce.number().min(1).max(9999999),
  content: z
    .string()
    .trim()
    .max(5000, { message: '回复内容不能超过 5000 个字符' })
})

export const adminRatingSearchTypeSchema = z.enum(['content', 'user'])
const adminRatingDeleteLimit = 30

export const adminRatingPaginationSchema = adminPaginationSchema.extend({
  limit: z.coerce.number().min(1).max(500),
  searchType: adminRatingSearchTypeSchema.default('content'),
  userId: z.coerce.number().min(1).max(9999999).optional()
})

const adminRatingIdsSchema = z
  .string()
  .trim()
  .min(1, { message: '至少选择一条评价' })
  .refine(
    (value) =>
      value.split(',').every((item) => {
        const trimmed = item.trim()
        if (!/^\d+$/.test(trimmed)) {
          return false
        }

        const ratingId = Number.parseInt(trimmed, 10)
        return ratingId >= 1 && ratingId <= 9999999
      }),
    { message: '评价 ID 格式不正确' }
  )
  .transform((value) => [
    ...new Set(
      value
        .split(',')
        .map((item) => Number.parseInt(item.trim(), 10))
        .filter((ratingId) => ratingId >= 1 && ratingId <= 9999999)
    )
  ])
  .refine((ratingIds) => ratingIds.length <= adminRatingDeleteLimit, {
    message: `单次最多删除 ${adminRatingDeleteLimit} 条评价`
  })

export const adminDeleteRatingSchema = z.union([
  z
    .object({
      ratingId: z.coerce
        .number({ message: '评价 ID 必须为数字' })
        .min(1)
        .max(9999999)
    })
    .transform(({ ratingId }) => ({
      ratingIds: [ratingId]
    })),
  z
    .object({
      ratingIds: adminRatingIdsSchema
    })
    .transform(({ ratingIds }) => ({
      ratingIds
    }))
])

export const patchRatingUpdateSchema = z.object({
  ratingId: z.coerce.number().min(1).max(9999999),
  shortSummary: z
    .string()
    .trim()
    .min(1, { message: '评价内容不可为空' })
    .max(1314, { message: '评价内容不能超过 1314 个字符' })
})

export const adminHandleReportSchema = z.object({
  reportId: z.coerce.number().min(1).max(9999999),
  action: z.enum(['delete', 'reject']),
  content: z
    .string()
    .trim()
    .max(5000, { message: '处理结果不能超过 5000 个字符' })
})

export const approvePatchResourceSchema = z.object({
  resourceId: z.coerce.number().min(1).max(9999999)
})

export const declinePatchResourceSchema = z.object({
  resourceId: z.coerce.number().min(1).max(9999999),
  reason: z
    .string()
    .trim()
    .min(1)
    .max(1007, { message: '拒绝原因不能超过 1007 个字符' })
})

export const adminUpdateRedirectSchema = z.object({
  enableRedirect: z.coerce.boolean(),
  excludedDomains: z.array(
    z.string().max(500, { message: '单个域名不能超过 500 个字符' })
  ),
  delaySeconds: z.coerce.number()
})

export const adminUpdateDisableRegisterSchema = z.object({
  disableRegister: z.boolean()
})

export const adminGetFullCommentSchema = z.object({
  commentId: z.coerce.number().min(1).max(9999999)
})

export const adminGetFullRatingSchema = z.object({
  ratingId: z.coerce.number().min(1).max(9999999)
})
