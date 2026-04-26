import {
  isPatchPath,
  isTagPath,
  isUserPath,
  isDocPath,
  isCompanyPath,
  isMessageNoticePath,
  isMessageChatConversationPath
} from './matcher'
import { keyLabelMap } from './constants'
import { kunMoyuMoe } from '~/config/moyu-moe'
import type { KunBreadcrumbItem } from './constants'

type NextParams = Readonly<Record<string, string | Array<string> | undefined>>

// Some path's length is equal to galgame uniqueId (8 digits and chars)
const pathToIgnore = ['/resource', '/register', '/redirect', '/settings']

const getParamValue = (params: NextParams, key: string): string | undefined => {
  const value = params[key]
  if (!value) {
    return undefined
  }

  return Array.isArray(value) ? value.join('/') : value
}

export const getBreadcrumbTitleKey = (
  pathname: string,
  params: NextParams
): string => {
  if (isPatchPath(pathname)) {
    const id = getParamValue(params, 'id')
    return id ? `/${id}` : pathname
  }

  if (isTagPath(pathname)) {
    const id = getParamValue(params, 'id')
    return id ? `/tag/${id}` : pathname
  }

  if (isUserPath(pathname)) {
    const id = getParamValue(params, 'id')
    return id ? `/user/${id}` : pathname
  }

  if (isDocPath(pathname)) {
    const slug = getParamValue(params, 'slug')
    return slug ? `/doc/${slug}` : pathname
  }

  if (isCompanyPath(pathname)) {
    const id = getParamValue(params, 'id')
    return id ? `/company/${id}` : pathname
  }

  if (isMessageChatConversationPath(pathname)) {
    const conversationId = getParamValue(params, 'conversationId')
    return conversationId ? `/message/chat/${conversationId}` : pathname
  }

  return pathname
}

const normalizeBreadcrumbTitle = (pageTitle?: string): string => {
  return (pageTitle ?? '')
    .replace(` - ${kunMoyuMoe.titleShort}`, '')
    .replace(/\|.*$/, '')
    .trim()
}

const getTitleOrDefault = (pageTitle: string, fallback: string): string => {
  return pageTitle || fallback
}

const createPatchBreadcrumb = (
  params: NextParams,
  defaultItem: KunBreadcrumbItem,
  pageTitle: string
) => {
  const id = getParamValue(params, 'id') ?? defaultItem.href.slice(1)

  return {
    ...defaultItem,
    key: `/${id}`,
    label: pageTitle,
    href: `/${id}`
  }
}

const createTagBreadcrumb = (
  params: NextParams,
  defaultItem: KunBreadcrumbItem,
  pageTitle: string
) => {
  const id = getParamValue(params, 'id') ?? defaultItem.href.split('/').pop()

  return {
    ...defaultItem,
    key: `/tag/${id}`,
    label: pageTitle,
    href: `/tag/${id}`
  }
}

const createUserBreadcrumb = (
  params: NextParams,
  defaultItem: KunBreadcrumbItem,
  pageTitle: string
) => {
  const id = getParamValue(params, 'id') ?? defaultItem.href.split('/')[2]

  return {
    ...defaultItem,
    key: `/user/${id}`,
    label: pageTitle,
    href: `/user/${id}/resource`
  }
}

const createDocBreadcrumb = (
  params: NextParams,
  defaultItem: KunBreadcrumbItem,
  pageTitle: string
) => {
  const slug = getParamValue(params, 'slug') ?? defaultItem.href.slice(5)

  return {
    ...defaultItem,
    key: `/doc/${slug}`,
    label: pageTitle,
    href: `/doc/${slug}`
  }
}

export const getKunPathLabel = (pathname: string): string => {
  const hasIgnorePath = pathToIgnore.some((p) => p === pathname)
  if (isPatchPath(pathname) && !hasIgnorePath) {
    return pathname
  }
  if (isDocPath(pathname)) {
    return pathname
  }

  for (const key in keyLabelMap) {
    const regex = new RegExp(`^${key.replace(/\[\w+\]/g, '\\d+')}$`)
    if (regex.test(pathname)) {
      return keyLabelMap[key]
    }
  }

  return keyLabelMap[pathname]
}

export const createBreadcrumbItem = (
  pathname: string,
  params: NextParams,
  pageTitle?: string
): KunBreadcrumbItem[] => {
  if (pathname === '/') {
    return []
  }

  const label = getKunPathLabel(pathname)
  if (!label) {
    return []
  }

  const defaultItem: KunBreadcrumbItem = {
    key: pathname,
    label,
    href: pathname
  }

  const normalizedPageTitle = normalizeBreadcrumbTitle(pageTitle)

  const hasIgnorePath = pathToIgnore.some((p) => p === pathname)
  if (hasIgnorePath) {
    return [defaultItem]
  }

  if (isPatchPath(pathname)) {
    const allGalgameRoute: KunBreadcrumbItem = {
      key: 'galgame',
      label: 'Galgame',
      href: '/galgame'
    }
    if (!normalizedPageTitle) {
      return [allGalgameRoute]
    }
    return [
      allGalgameRoute,
      createPatchBreadcrumb(params, defaultItem, normalizedPageTitle)
    ]
  }
  if (isTagPath(pathname)) {
    const allTagRoute: KunBreadcrumbItem = {
      key: 'tag',
      label: '游戏标签',
      href: '/tag'
    }
    return [
      allTagRoute,
      createTagBreadcrumb(
        params,
        defaultItem,
        getTitleOrDefault(normalizedPageTitle, defaultItem.label)
      )
    ]
  }
  if (isUserPath(pathname)) {
    return [
      createUserBreadcrumb(
        params,
        defaultItem,
        getTitleOrDefault(normalizedPageTitle, defaultItem.label)
      )
    ]
  }
  if (isDocPath(pathname)) {
    const allDocRoute: KunBreadcrumbItem = {
      key: 'doc',
      label: '帮助文档',
      href: '/doc'
    }
    return [
      allDocRoute,
      createDocBreadcrumb(
        params,
        defaultItem,
        getTitleOrDefault(normalizedPageTitle, defaultItem.label)
      )
    ]
  }
  if (isCompanyPath(pathname)) {
    const allCompanyRoute: KunBreadcrumbItem = {
      key: 'company',
      label: '游戏会社',
      href: '/company'
    }
    const companyName =
      normalizedPageTitle.match(/所属会社为 (.+?) 的 Galgame/)?.[1] ??
      normalizedPageTitle
    return [
      allCompanyRoute,
      {
        ...defaultItem,
        label: getTitleOrDefault(companyName, defaultItem.label)
      }
    ]
  }
  if (isMessageNoticePath(pathname)) {
    const noticeRoute: KunBreadcrumbItem = {
      key: '/message/notice',
      label: '通知消息',
      href: '/message/notice'
    }
    return [noticeRoute, defaultItem]
  }
  if (isMessageChatConversationPath(pathname)) {
    const chatRoute: KunBreadcrumbItem = {
      key: '/message/chat',
      label: '私聊消息',
      href: '/message/chat'
    }
    return [
      chatRoute,
      {
        ...defaultItem,
        label: getTitleOrDefault(normalizedPageTitle, defaultItem.label)
      }
    ]
  }

  return [defaultItem]
}
