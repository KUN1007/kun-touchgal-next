import { z } from 'zod'

export const patchCreateSchema = z.object({
  banner: z.any(),
  name: z.string().trim().min(1, { message: '游戏名称是必填项' }),
  vndbId: z.string().max(10).optional(),
  introduction: z
    .string()
    .trim()
    .min(10, { message: '游戏介绍是必填项, 最少 10 个字符' })
    .max(100007, { message: '游戏介绍最多 100007 字' }),
  alias: z
    .string()
    .max(2333, { message: '别名字符串总长度不可超过 3000 个字符' }),
  released: z.string().optional(),
  contentLimit: z.string().max(10)
})

export const patchUpdateSchema = z.object({
  id: z.coerce.number().min(1).max(9999999),
  name: z.string().trim().min(1, { message: '游戏名称是必填项' }),
  introduction: z
    .string()
    .trim()
    .min(10, { message: '游戏介绍是必填项, 最少 10 个字符' })
    .max(100007, { message: '游戏介绍最多 100007 字' }),
  alias: z
    .array(
      z
        .string()
        .trim()
        .min(1, { message: '单个别名至少一个字符' })
        .max(500, { message: '单个别名至多 500 个字符' })
    )
    .max(30, { message: '您最多使用 30 个别名' })
    .optional(),
  contentLimit: z.string().max(10)
})

export const duplicateSchema = z.object({
  vndbId: z.string().regex(/^v\d{1,6}$/, { message: 'VNDB ID 格式无效' })
})

export const imageSchema = z.object({
  image: z.any()
})

export const editLinkSchema = z.object({
  name: z.string({ message: '您的输入应为字符串' }),
  link: z
    .string({ message: '您的输入应为字符串' })
    .url({ message: '您输入的链接必须为合法 URL' })
})
