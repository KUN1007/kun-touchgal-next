import { prisma } from '~/prisma/index'

const patchUserSelect = {
  id: true,
  name: true,
  avatar: true
} as const

const patchAliasSelect = {
  name: true
} as const

const patchCountSelect = {
  favorite_folder: true,
  resource: { where: { status: 0 } },
  // 资源评论 (resource_id 非空) 属资源详情页评论区, 不计入补丁评论数
  comment: { where: { status: 0, resource_id: null } }
} as const

const patchTagNameSelect = {
  tag: {
    select: {
      name: true
    }
  }
} as const

const patchTagDetailSelect = {
  tag: {
    select: {
      id: true,
      name: true,
      count: true,
      alias: true
    }
  }
} as const

const patchCompanyDetailSelect = {
  company: {
    select: {
      id: true,
      name: true,
      count: true,
      alias: true
    }
  }
} as const

export const getPatchSummaryByUniqueId = async (uniqueId: string) =>
  prisma.patch.findUnique({
    where: { unique_id: uniqueId },
    include: {
      user: {
        select: patchUserSelect
      },
      tag: {
        select: patchTagNameSelect
      },
      alias: {
        select: patchAliasSelect
      },
      rating_stat: true,
      _count: {
        select: patchCountSelect
      }
    }
  })

export const getPatchIntroductionContentByUniqueId = async (uniqueId: string) =>
  prisma.patch.findUnique({
    where: { unique_id: uniqueId },
    include: {
      alias: {
        select: patchAliasSelect
      },
      tag: {
        select: patchTagDetailSelect
      },
      company: {
        select: patchCompanyDetailSelect
      }
    }
  })

export const getPatchPageContentByUniqueId = async (uniqueId: string) =>
  prisma.patch.findUnique({
    where: { unique_id: uniqueId },
    include: {
      user: {
        select: patchUserSelect
      },
      tag: {
        select: patchTagDetailSelect
      },
      company: {
        select: patchCompanyDetailSelect
      },
      alias: {
        select: patchAliasSelect
      },
      rating_stat: true,
      _count: {
        select: patchCountSelect
      }
    }
  })
