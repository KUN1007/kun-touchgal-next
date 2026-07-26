export const isPatchPath = (pathname: string): boolean => {
  return /^\/[A-Za-z0-9]{8}$/.test(pathname)
}

export const isPatchResourcePath = (pathname: string): boolean => {
  return /^\/[A-Za-z0-9]{8}\/resource\/\d+$/.test(pathname)
}

export const isTagPath = (pathname: string): boolean => {
  return /^\/tag\/\d+/.test(pathname)
}

export const isUserPath = (pathname: string): boolean => {
  return /^\/user\/\d+/.test(pathname)
}

export const isDocPath = (pathname: string): boolean => {
  return /^\/doc\/.*/.test(pathname)
}

export const isCompanyPath = (pathname: string): boolean => {
  return /^\/company\/\d+/.test(pathname)
}

export const isMessageNoticePath = (pathname: string): boolean => {
  return ['/message/follow', '/message/system', '/message/mention'].includes(
    pathname
  )
}

export const isMessageChatConversationPath = (pathname: string): boolean => {
  return /^\/message\/chat\/\d+$/.test(pathname)
}
