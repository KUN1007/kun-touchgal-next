import { z } from 'zod'
import { ResourceSizeRegex } from '~/utils/validate'
import {
  SUPPORTED_TYPE,
  SUPPORTED_LANGUAGE,
  SUPPORTED_PLATFORM,
  SUPPORTED_RESOURCE_LINK,
  SUPPORTED_RESOURCE_SECTION
} from '~/constants/resource'
import {
  KUN_GALGAME_RATING_RECOMMEND_CONST,
  KUN_GALGAME_RATING_SPOILER_CONST,
  KUN_GALGAME_RATING_PLAY_STATUS_CONST
} from '~/constants/galgame'

export const patchTagChangeSchema = z.object({
  patchId: z.coerce.number({ message: 'ID 必须为数字' }).min(1).max(9999999),
  tagId: z
    .array(
      z.coerce.number({ message: '标签 ID 必须为数字' }).min(1).max(9999999)
    )
    .min(1)
    .max(107, { message: '一个 Galgame 最多有 107 个标签' })
})

export const patchCompanyChangeSchema = z.object({
  patchId: z.coerce
    .number({ message: 'Galgame ID 必须为数字' })
    .min(1)
    .max(9999999),
  companyId: z
    .array(
      z.coerce.number({ message: '会社 ID 必须为数字' }).min(1).max(9999999)
    )
    .min(1)
    .max(107, { message: '一个 Galgame 最多有 107 个会社' })
})

export const patchCommentCreateSchema = z.object({
  patchId: z.coerce.number().min(1).max(9999999),
  parentId: z.coerce.number().min(1).max(9999999).nullable(),
  content: z
    .string()
    .trim()
    .min(1, { message: '评论的内容最少为 1 个字符' })
    .max(10007, { message: '评论的内容最多为 10007 个字符' })
})

export const patchCommentUpdateSchema = z.object({
  commentId: z.coerce.number().min(1).max(9999999),
  content: z
    .string()
    .trim()
    .min(1, { message: '评论的内容最少为 1 个字符' })
    .max(10007, { message: '评论的内容最多为 10007 个字符' })
})

export const patchResourceCreateSchema = z.object({
  patchId: z.coerce.number().min(1).max(9999999),
  section: z
    .string()
    .refine((type) => SUPPORTED_RESOURCE_SECTION.includes(type), {
      message: '资源链接类型仅能为 Galgame 或补丁'
    }),
  name: z.string().max(300, { message: '资源名称最多 300 个字符' }),
  storage: z.string().refine((type) => SUPPORTED_RESOURCE_LINK.includes(type), {
    message: '非法的资源链接类型'
  }),
  hash: z.string().max(107),
  content: z
    .string()
    .min(1)
    .max(1007, { message: '您的资源链接内容最多 1007 个字符' }),
  size: z
    .string()
    .regex(ResourceSizeRegex, { message: '请选择资源的大小, MB 或 GB' }),
  code: z.string().trim().max(1007, { message: '资源提取码长度最多 1007 位' }),
  password: z.string().max(1007, { message: '资源解压码长度最多 1007 位' }),
  note: z.string().max(10007, { message: '资源备注最多 10007 字' }),
  type: z
    .array(z.string())
    .min(1, { message: '请选择至少一个资源类型' })
    .max(10, { message: '您的单个资源最多有 10 条链接' })
    .refine((types) => types.every((type) => SUPPORTED_TYPE.includes(type)), {
      message: '非法的类型'
    }),
  language: z
    .array(z.string())
    .min(1, { message: '请选择至少一个资源语言' })
    .max(10, { message: '您的单个资源最多有 10 个语言' })
    .refine(
      (types) => types.every((type) => SUPPORTED_LANGUAGE.includes(type)),
      { message: '非法的语言' }
    ),
  platform: z
    .array(z.string())
    .min(1, { message: '请选择至少一个资源平台' })
    .max(10, { message: '您的单个资源最多有 10 个平台' })
    .refine(
      (types) => types.every((type) => SUPPORTED_PLATFORM.includes(type)),
      { message: '非法的平台' }
    )
})

export const patchResourceUpdateSchema = patchResourceCreateSchema.merge(
  z.object({
    resourceId: z.coerce.number().min(1).max(9999999)
  })
)

export const declinePullRequestSchema = z.object({
  prId: z.coerce.number({ message: 'ID 必须为数字' }).min(1).max(9999999),
  note: z
    .string({ message: '必须填写拒绝原因' })
    .trim()
    .min(1)
    .max(1007, { message: '拒绝原因最多 1007 个字符' })
})

export const updatePatchBannerSchema = z.object({
  patchId: z.coerce.number().min(1).max(9999999),
  image: z.any()
})

export const getPatchHistorySchema = z.object({
  patchId: z.coerce.number({ message: 'ID 必须为数字' }).min(1).max(9999999),
  page: z.coerce.number().min(1).max(9999999),
  limit: z.coerce.number().min(1).max(30)
})

export const updatePatchResourceStatsSchema = z.object({
  patchId: z.coerce.number({ message: 'ID 必须为数字' }).min(1).max(9999999),
  resourceId: z.coerce.number({ message: 'ID 必须为数字' }).min(1).max(9999999)
})

export const createPatchFeedbackSchema = z.object({
  patchId: z.coerce.number({ message: 'ID 必须为数字' }).min(1).max(9999999),
  content: z
    .string({ message: '反馈内容为必填字段' })
    .min(10, { message: '反馈信息最少 10 个字符' })
    .max(5000, { message: '反馈信息最多 5000 个字符' })
})

export const createPatchCommentReportSchema = z.object({
  commentId: z.coerce
    .number({ message: '评论 ID 必须为数字' })
    .min(1)
    .max(9999999),
  patchId: z.coerce
    .number({ message: '游戏 ID 必须为数字' })
    .min(1)
    .max(9999999),
  content: z
    .string({ message: '举报原因为必填字段' })
    .min(2, { message: '举报原因最少 2 个字符' })
    .max(5000, { message: '举报原因最多 5000 个字符' })
})

export const togglePatchFavoriteSchema = z.object({
  patchId: z.coerce
    .number({ message: '游戏 ID 必须为数字' })
    .min(1)
    .max(9999999),
  folderId: z.coerce
    .number({ message: '收藏文件夹 ID 必须为数字' })
    .min(1)
    .max(9999999)
})

export const patchRatingCreateSchema = z.object({
  patchId: z.coerce
    .number({ message: 'patch rating ID 格式不正确' })
    .min(1)
    .max(9999999),
  recommend: z
    .string({ message: '推荐程度不正确' })
    .refine((v) => KUN_GALGAME_RATING_RECOMMEND_CONST.includes(v as any), {
      message: '推荐程度不正确'
    }),
  overall: z.coerce
    .number({ message: '评分不正确' })
    .min(1, { message: '评分最小为 1' })
    .max(10, { message: '评分最大为 10' }),
  playStatus: z
    .string({ message: '游玩状态不正确' })
    .refine((v) => KUN_GALGAME_RATING_PLAY_STATUS_CONST.includes(v as any), {
      message: '游玩状态不正确'
    }),
  shortSummary: z
    .string({ message: '简评不正确' })
    .trim()
    .max(1314, { message: '简评最多 1314 字' }),
  spoilerLevel: z
    .string({ message: '剧透等级不正确' })
    .refine((v) => KUN_GALGAME_RATING_SPOILER_CONST.includes(v as any), {
      message: '剧透等级不正确'
    })
})

export const patchRatingUpdateSchema = patchRatingCreateSchema.merge(
  z.object({
    ratingId: z.coerce
      .number({ message: 'patch rating ID 格式不正确' })
      .min(1)
      .max(9999999)
  })
)
