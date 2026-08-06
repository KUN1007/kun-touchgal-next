import { z } from 'zod'
import { MAX_GALGAME_FILTER_VALUES } from '~/utils/galgameFilter'

export const searchSchema = z.object({
  queryString: z
    .string()
    .min(1)
    .max(1007, { message: '您的搜素字符串最大为 1007 个字符' }),
  limit: z.coerce.number().min(1).max(24),
  searchOption: z.object({
    searchInIntroduction: z.boolean().default(false),
    searchInAlias: z.boolean().default(false),
    searchInTag: z.boolean().default(false)
  }),

  page: z.coerce.number().min(1).max(9999999),
  selectedType: z.string().min(1).max(107),
  selectedLanguage: z.string().min(1).max(107),
  selectedPlatform: z.string().min(1).max(107),
  sortField: z.union([
    z.literal('resource_update_time'),
    z.literal('created'),
    z.literal('rating'),
    z.literal('view'),
    z.literal('download'),
    z.literal('favorite')
  ]),
  sortOrder: z.union([z.literal('asc'), z.literal('desc')]),
  selectedYears: z
    .array(z.string().trim().min(1).max(50))
    .max(MAX_GALGAME_FILTER_VALUES, {
      message: `您最多选择 ${MAX_GALGAME_FILTER_VALUES} 组年份`
    }),
  selectedMonths: z
    .array(z.string().trim().min(1).max(50))
    .max(13, { message: '您最多选择 13 组月份' }),
  minRatingCount: z.coerce.number().min(0).max(999999).default(10)
})

export const searchTagSchema = z.object({
  query: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(107, { message: '单个搜索关键词最大长度为 107' })
    )
    .min(1)
    .max(10, { message: '您最多使用 10 组关键词' })
})
