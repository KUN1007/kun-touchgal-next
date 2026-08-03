// 保留用户名表（公开部分）：系统词与项目词，禁止用户将用户名设置为表中的词。
// 本文件被客户端表单校验复用，会进入浏览器 bundle，只允许放公开无害的词；
// 敏感词部分见 constants/reserved-usernames.server.ts（摘要存储，仅服务端）。
// 所有条目必须为小写，比较时对输入做 trim + toLowerCase 后精确匹配。
// 与数据库用户名查重（mode: 'insensitive'）一样只折叠 ASCII 大小写；
// 全角/同形异义/繁简变体（ａｄｍｉｎ、аdmin、天安門）两边一致地放过，
// 属既有用户名体系限制，不做 NFKC 归一化以免与 DB 查重语义分叉。
export const RESERVED_USERNAMES: readonly string[] = [
  // 常见系统词
  'admin',
  'administrator',
  'root',
  'system',
  'sys',
  'superuser',
  'operator',
  'manager',
  'guest',
  'anonymous',
  'anon',
  'test',
  'testing',
  'null',
  'undefined',
  'none',
  'api',
  'server',
  'service',
  'support',
  'official',
  'mod',
  '官方',
  '管理员',
  '系统',
  '客服',
  '测试',
  '游客',
  '匿名',
  '站长',
  // 项目词
  'touchgal',
  'palentum'
]
export const reservedUsernameMessage = '该用户名已被系统保留，请更换'

export const normalizeReservedUsername = (name: string) =>
  name.trim().toLowerCase()

export const isReservedUsername = (name: string) => {
  return RESERVED_USERNAMES.includes(normalizeReservedUsername(name))
}
