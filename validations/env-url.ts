import { z } from 'zod'

// 不要用 z.string().url(): zod 4 底层是 WHATWG new URL(), 'localhost:3000' /
// 'www.moyu.moe:443' 这类 scheme-less 值会按 opaque scheme 解析而通过校验,
// 且 host 为空串, 下游 (middleware/_csrf.ts) 取 host 时会静默产生空 CSRF 白名单。
// 限定 http(s) 协议后 WHATWG 保证 host 非空。
export const kunWebUrlSchema = z.url({ protocol: /^https?$/ })
