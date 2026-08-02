// 保留用户名表：禁止用户将用户名设置为表中的词。
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
  'palentum',
  // 常见政治敏感词：领导人姓名
  '***',
  '***',
  '***',
  '***',
  '***',
  '***',
  '***',
  '***',
  '***',
  '***',
  '***',
  '***',
  '***',
  '***',
  '***',
  '***',
  '***',
  // 常见政治敏感词：事件与组织
  '***',
  '***',
  '***',
  '***',
  '***',
  '***',
  '***',
  '***',
  // 常见政治敏感词：分裂主张
  '***',
  '***',
  '***',
  '***'
]
export const reservedUsernameMessage = '该用户名已被系统保留，请更换'

export const isReservedUsername = (name: string) => {
  return RESERVED_USERNAMES.includes(name.trim().toLowerCase())
}
