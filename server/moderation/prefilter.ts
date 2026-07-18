import { createHash } from 'crypto'
import {
  MODERATION_TEXT_HEAD_LENGTH,
  MODERATION_TEXT_MAX_LENGTH,
  MODERATION_TEXT_TAIL_LENGTH
} from '~/constants/moderation'

const WHITELIST_MAX_LENGTH = 20

// any URL / long digit run / contact-channel feature disables the whitelist
const SUSPICIOUS_PATTERN =
  /https?:|www\.|\.com|\.cn|\.net|\.org|\.moe|\.top|\.xyz|\d{5,}|qq|vx|v信|微信|weixin|telegram|电报|加群|q群/i

// common harmless filler words in comment sections, longest first so that
// longer phrases are consumed before their sub-words
const WHITELIST_WORDS = [
  '感谢分享',
  '谢谢分享',
  '感谢大佬',
  '谢谢大佬',
  '多谢分享',
  '期待更新',
  '奇怪的知识增加了',
  '已下载',
  '下载了',
  '来看看',
  '收藏了',
  '辛苦了',
  '太棒了',
  '太强了',
  '好游戏',
  '牛逼',
  '牛批',
  '厉害',
  '感谢',
  '谢谢',
  '多谢',
  '蟹蟹',
  '好耶',
  '神作',
  '经典',
  '有趣',
  '好玩',
  '收藏',
  '马克',
  '试试',
  '来了',
  '冲了',
  '催更',
  '期待',
  '加油',
  '辛苦',
  '大佬',
  '老师',
  '支持',
  '爱了',
  '可以',
  '不错',
  '很好',
  'thanks',
  'thank you',
  'mark',
  'thx',
  '3q',
  '冲',
  '牛',
  '强',
  '棒',
  '赞',
  '顶',
  '好',
  '草',
  '哈',
  '嗯',
  '哦',
  '哇',
  'w',
  '6'
].sort((a, b) => b.length - a.length)

// worker-side builtin blacklist, keep patterns high-precision only since a
// hit rejects the content directly with no human in the loop
const BUILTIN_BLACKLIST_PATTERNS: RegExp[] = [
  /qq?群[:：]?\d{5,}/,
  /加群[:：]?\d{5,}/
]

export const normalizeModerationText = (text: string) =>
  text.normalize('NFKC').toLowerCase().replace(/\s+/g, '')

export const hashModerationText = (normalizedText: string) =>
  createHash('sha256').update(normalizedText).digest('hex')

// strip base64 blobs / html tags and collapse whitespace, then keep only the
// head and tail of overlong text (spam contact info clusters at both ends)
export const prepareModerationText = (raw: string) => {
  const compact = raw
    .replace(/data:[a-z0-9/+.-]+;base64,[a-z0-9+/=]+/gi, '[图片]')
    .replace(/<[^>]{0,200}?>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (compact.length <= MODERATION_TEXT_MAX_LENGTH) {
    return compact
  }
  return `${compact.slice(0, MODERATION_TEXT_HEAD_LENGTH)}\n…\n${compact.slice(-MODERATION_TEXT_TAIL_LENGTH)}`
}

// zero-token quick pass at publish time: short text composed entirely of
// emoji / punctuation / common filler words goes straight through
export const isWhitelistedText = (raw: string) => {
  const text = raw.normalize('NFKC').trim().toLowerCase()
  if (!text || text.length > WHITELIST_MAX_LENGTH) {
    return false
  }
  if (SUSPICIOUS_PATTERN.test(text)) {
    return false
  }
  // 分隔符格式的联系方式 (手机号 / QQ) 可绕过连续 \d{5,} 检测,
  // 短文本里数字总量达到联系方式量级时不走白名单快速放行
  const digitCount = (text.match(/\p{Nd}/gu) ?? []).length
  if (digitCount >= 5) {
    return false
  }

  let rest = text
  for (const word of WHITELIST_WORDS) {
    rest = rest.replaceAll(word, '')
  }
  rest = rest.replace(
    /[\p{Extended_Pictographic}\p{P}\p{S}\p{Z}\p{N}\p{M}~！？。，、]/gu,
    ''
  )
  return rest.length === 0
}

export interface ModerationBlacklistEntry {
  pattern: string
  content_types: string[]
}

// 取对该 content_type 生效的模式; 空 content_types 表示对全部类型生效
export const filterBlacklistPatterns = (
  entries: ModerationBlacklistEntry[],
  contentType: string
): string[] =>
  entries
    .filter(
      (entry) =>
        !entry.content_types.length || entry.content_types.includes(contentType)
    )
    .map((entry) => entry.pattern)

export const matchBlacklist = (
  normalizedText: string,
  patterns: string[]
): string | null => {
  for (const regex of BUILTIN_BLACKLIST_PATTERNS) {
    const matched = normalizedText.match(regex)
    if (matched) {
      return matched[0]
    }
  }
  for (const pattern of patterns) {
    const normalizedPattern = normalizeModerationText(pattern)
    if (normalizedPattern && normalizedText.includes(normalizedPattern)) {
      return pattern
    }
  }
  return null
}
