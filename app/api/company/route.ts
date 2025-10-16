import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '~/prisma'
import {
  createCompanySchema,
  getCompanyByIdSchema,
  updateCompanySchema
} from '~/validations/company'
import {
  kunParseGetQuery,
  kunParsePostBody,
  kunParsePutBody
} from '../utils/parseQuery'
import { verifyHeaderCookie } from '~/middleware/_verifyHeaderCookie'

export const getCompanyById = async (
  input: z.infer<typeof getCompanyByIdSchema>
) => {
  const { companyId } = input

  const company = await prisma.patch_company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      count: true,
      alias: true,
      introduction: true,
      primary_language: true,
      official_website: true,
      parent_brand: true,
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
  if (!company) {
    return '未找到公司'
  }

  return company
}

export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, getCompanyByIdSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const response = await getCompanyById(input)
  return NextResponse.json(response)
}

export const rewriteCompany = async (
  input: z.infer<typeof updateCompanySchema>
) => {
  const {
    companyId,
    name,
    primary_language,
    introduction = '',
    alias = [],
    official_website = [],
    parent_brand = []
  } = input

  const existingCompany = await prisma.patch_company.findFirst({
    where: {
      OR: [{ name }, { alias: { has: name } }]
    }
  })
  if (existingCompany && existingCompany.id !== companyId) {
    return '这个会社已经存在了'
  }

  const newCompany = await prisma.patch_company.update({
    where: { id: companyId },
    data: {
      name,
      introduction,
      alias,
      primary_language,
      official_website,
      parent_brand
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

  return newCompany
}

export const PUT = async (req: NextRequest) => {
  const input = await kunParsePutBody(req, updateCompanySchema)
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

  const response = await rewriteCompany(input)
  return NextResponse.json(response)
}

export const createCompany = async (
  input: z.infer<typeof createCompanySchema>,
  uid: number
) => {
  const {
    name,
    primary_language,
    introduction = '',
    alias = [],
    official_website = [],
    parent_brand = []
  } = input

  const existingCompany = await prisma.patch_company.findFirst({
    where: {
      OR: [{ name }, { alias: { has: name } }]
    }
  })
  if (existingCompany) {
    return '这个会社已经存在了'
  }

  const newCompany = await prisma.patch_company.create({
    data: {
      user_id: uid,
      name,
      introduction,
      alias,
      primary_language,
      official_website,
      parent_brand
    },
    select: {
      id: true,
      name: true,
      count: true,
      alias: true
    }
  })

  return newCompany
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, createCompanySchema)
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

  const response = await createCompany(input, payload.uid)
  return NextResponse.json(response)
}
