import { z } from 'zod'

const duplicateQueryField = (maxLength: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return undefined
      }
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : undefined
    },
    z.string().max(maxLength).optional()
  )

export const patchCreateSchema = z.object({
  banner: z.any(),
  name: z.string().trim().min(1, { message: '游戏名称是必填项' }),
  vndbId: z.string().max(10),
  vndbRelationId: z.string().max(10),
  dlsiteCode: z.string().max(20),
  introduction: z
    .string()
    .trim()
    .min(10, { message: '游戏介绍是必填项, 最少 10 个字符' })
    .max(100007, { message: '游戏介绍最多 100007 字' }),
  alias: z
    .string()
    .max(2333, { message: '别名字符串总长度不可超过 3000 个字符' }),
  tag: z
    .string()
    .max(2333, { message: '别名字符串总长度不可超过 3000 个字符' }),
  released: z.string(),
  contentLimit: z.string().max(10)
})

export const patchUpdateSchema = z.object({
  id: z.coerce.number().min(1).max(9999999),
  name: z.string().trim().min(1, { message: '游戏名称是必填项' }),
  vndbId: z.string().max(10),
  vndbRelationId: z.string().max(10),
  dlsiteCode: z.string().max(20),
  introduction: z
    .string()
    .trim()
    .min(10, { message: '游戏介绍是必填项, 最少 10 个字符' })
    .max(100007, { message: '游戏介绍最多 100007 字' }),
  tag: z.array(
    z
      .string()
      .trim()
      .min(1, { message: '单个标签至少一个字符' })
      .max(500, { message: '单个标签至多 500 个字符' })
  ),
  alias: z.array(
    z
      .string()
      .trim()
      .min(1, { message: '单个别名至少一个字符' })
      .max(500, { message: '单个别名至多 500 个字符' })
  ),
  contentLimit: z.string().max(10),
  released: z.string().optional()
})

export const duplicateSchema = z
  .object({
    vndbId: duplicateQueryField(10),
    vndbRelationId: duplicateQueryField(10),
    dlsiteCode: duplicateQueryField(20),
    title: duplicateQueryField(1007)
  })
  .refine(
    (data) => Object.values(data).some((value) => typeof value === 'string'),
    {
      message: '请至少提供一个查重字段'
    }
  )

export const imageSchema = z.object({
  image: z.any()
})

export const editLinkSchema = z.object({
  name: z.string({ message: '您的输入应为字符串' }),
  link: z
    .string({ message: '您的输入应为字符串' })
    .url({ message: '您输入的链接必须为合法 URL' })
})
