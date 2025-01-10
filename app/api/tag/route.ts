import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import {
  kunParseGetQuery,
  kunParsePostBody,
  kunParsePutBody
} from '~/app/api/utils/parseQuery'
import { prisma } from '~/prisma/index'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'
import {
  createTagSchema,
  getTagByIdSchema,
  updateTagSchema
} from '~/validations/tag'
import type { TagDetail } from '~/types/api/tag'

export const getTagById = async (input: z.infer<typeof getTagByIdSchema>) => {
  const { tagId } = input

  const tag: TagDetail | null = await prisma.patch_tag.findUnique({
    where: { id: tagId },
    select: {
      id: true,
      name: true,
      count: true,
      alias: true,
      introduction: true,
      created: true,
      user: {
        select: {
          id: true,
          name: true,
          avatar: true
        }
      }
    }
  })
  if (!tag) {
    return '未找到标签'
  }

  return tag
}

export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, getTagByIdSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const response = await getTagById(input)
  return NextResponse.json(response)
}

export const rewriteTag = async (input: z.infer<typeof updateTagSchema>) => {
  const { tagId, name, introduction = '', alias = [] } = input

  const existingTag = await prisma.patch_tag.findFirst({
    where: {
      OR: [{ name }, { alias: { has: name } }]
    }
  })
  if (existingTag && existingTag.id !== tagId) {
    return '这个标签已经存在了'
  }

  const newTag: TagDetail = await prisma.patch_tag.update({
    where: { id: tagId },
    data: {
      name,
      introduction,
      alias
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatar: true
        }
      }
    }
  })

  return newTag
}

export const PUT = async (req: NextRequest) => {
  const input = await kunParsePutBody(req, updateTagSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }
  if (payload.role < 3) {
    return NextResponse.json('本页面仅管理员可访问')
  }

  const response = await rewriteTag(input)
  return NextResponse.json(response)
}

export const createTag = async (
  input: z.infer<typeof createTagSchema>,
  uid: number
) => {
  const { name, introduction = '', alias = [] } = input

  const existingTag = await prisma.patch_tag.findFirst({
    where: {
      OR: [{ name }, { alias: { has: name } }]
    }
  })
  if (existingTag) {
    return '这个标签已经存在了'
  }

  const newTag = await prisma.patch_tag.create({
    data: {
      user_id: uid,
      name,
      introduction,
      alias
    },
    select: {
      id: true,
      name: true,
      count: true,
      alias: true
    }
  })

  return newTag
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, createTagSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const payload = await verifyHeaderCookie(req)
  if (!payload) {
    return NextResponse.json('用户未登录')
  }
  if (payload.role < 3) {
    return NextResponse.json('本页面仅管理员可访问')
  }

  const response = await createTag(input, payload.uid)
  return NextResponse.json(response)
}
