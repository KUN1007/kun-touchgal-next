// 修改本文件中的 sanitize 策略后，必须在
// app/api/utils/render/markdownToHtmlComment.ts 中递增 COMMENT_HTML_VERSION，
// 并运行 `pnpm backfill:comment-html` 重新渲染所有评论，否则旧落库 HTML 仍按旧策略服务用户。
import { defaultSchema } from 'rehype-sanitize'
import {
  SAFE_LINK_PROTOCOL_NAMES,
  SAFE_MEDIA_PROTOCOL_NAMES
} from '~/utils/safeUrl'
import type { Options as RehypeSanitizeOptions } from 'rehype-sanitize'

const defaultProtocols = defaultSchema.protocols || {}

const linkAttributes = [
  'data-kun-external-link',
  'data-href',
  'data-text',
  'href',
  'target',
  'rel',
  'className'
]

const imageAttributes = ['src', 'alt', 'title', 'class', 'loading']
const svgAttributes = [
  'aria-hidden',
  'className',
  'fill',
  'height',
  'shapeRendering',
  'stroke',
  'strokeLinecap',
  'strokeLinejoin',
  'strokeWidth',
  'viewBox',
  'width'
]
const pathAttributes = ['d']

const safeProtocols = {
  ...defaultProtocols,
  href: SAFE_LINK_PROTOCOL_NAMES,
  src: SAFE_MEDIA_PROTOCOL_NAMES,
  'data-href': SAFE_LINK_PROTOCOL_NAMES,
  'data-src': SAFE_MEDIA_PROTOCOL_NAMES
}

export const markdownSanitizeSchema: RehypeSanitizeOptions = {
  ...defaultSchema,
  attributes: {
    a: linkAttributes,
    img: imageAttributes
  },
  protocols: safeProtocols
}

export const markdownExtendSanitizeSchema: RehypeSanitizeOptions = {
  ...markdownSanitizeSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'svg', 'path'],
  attributes: {
    div: [
      'data-video-player',
      'data-src',
      'data-kun-link',
      'data-href',
      'data-text',
      'data-kun-img-container',
      'role',
      'tabIndex',
      'aria-label',
      'className'
    ],
    img: imageAttributes,
    a: linkAttributes,
    svg: svgAttributes,
    path: pathAttributes
  }
}
