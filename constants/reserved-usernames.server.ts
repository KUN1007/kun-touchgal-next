import { createHash } from 'node:crypto'
import {
  isReservedUsername,
  normalizeReservedUsername
} from '~/constants/reserved-usernames'

// 保留用户名表（敏感部分）：仓库与浏览器 bundle 都是公开可读的，明文清单本身
// 比它拦截的用户名更值得防，故只存 SHA-256 摘要。依赖 node:crypto 也顺带保证
// 本文件无法被打进客户端 chunk。
// 摘要对象为 normalizeReservedUsername(词) 的 UTF-8 字节，新增条目用：
//   node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1].trim().toLowerCase()).digest('hex'))" '词'
const SENSITIVE_RESERVED_USERNAME_HASHES: ReadonlySet<string> = new Set([
  '00c3d1fb3a3e7978bec331648b5b2ce9c4b28e2dda0b2568a38bb2238dc57bfd',
  '02802cbb452da592f2d1b4960dcb2904a3976535a1eaccded4904dd973fea702',
  '0786a2211d406e399326a3cd8bb17bb433554854969f2dc1895edd62a4480978',
  '0c3db100706bfd0cfc1ef34fe6544470d611ebd53e797b3f0a3c563f9940c384',
  '11d18d44dbdc5b3ffe45ee71bacb902a0bd11efcd668587fb6dc0a1dd3b9b563',
  '28aa9db75d2a6e4d08e6fe89695de175322f0cff6d0f742c1e1a8391244325f1',
  '3808441889174bfb0088d30b36be53fb9c915954bdaff061950fcd8986249b84',
  '3a984a00fe230003b4f0c3724b19fe06489007d7eb7bc8940d2948c2bc0030e8',
  '3d4818a8535e24960b3e1ceb3f343915260fcc874601b4ebfbf14af28d46fea0',
  '4617ad6142c8c07a668e5b880624e6dc697e51dd1bbb29abb8f3727e2ea1d48b',
  '4940b6043da6a38016fc52c0377fa239f404b623490a9ecd4c2f1dc133add5ea',
  '49fe431756b9c3ff15ea41f05e4c8f8ab3943b18c05f09e20bb78e0c3d08cf5e',
  '510e0f7b61c155949f57b9f14de00f36508b869b8efe7ec63847d6dbab8503ef',
  '61a40d8f1296d3872a1a87ab8fd87bb9f641b55c3a755b0d2f8746bafbef9c22',
  '6654a71686f39b94289650d9698d17b28c91bba860036de30cc81cf0e4fd9ddd',
  '694748b558f5ba38447dcc9cbedc3379a4344e573ff4c414f4067110b2fe7436',
  '7bac1aee5b5d1901fd535c8e5cd318d9e5ddb0c8fdc85dac501e1aa542a49b3b',
  '92a054e84d6e2e13d14cfb9b7ac898f70bea1637bc3aaeb075cd7344b3ecd0d4',
  'a16c7d5157506212720694f8f834074ba1dd9da7bf8b329834486b26d4acdc4e',
  'ac2e5da71c01c035d594c8ead71745bfc500348689c03cbf4e0c77829e3d0fbb',
  'bfaf925ba74daf0b40d70b25afb47ef4e8712db1be1022bbf8319b8dc02bd231',
  'c331958d468bafb841ae4d6f5c6edc233b1dff62cd41749c1555b0abce9f4fca',
  'c837b1efc19779b58c12ff020f1402147f6695c311165be6e34d46181d4f8184',
  'e10a333ca069372b79b8e3b8a4250a25667a992de209ff95ed91f31d2e5c1d30',
  'e16cae5e69d94a65dc464849698566f99dbaace2754b48e279b79fc34ea1f2e2',
  'e540426218dfc1c974b96d4dbf44074a194e109ab1e82cd16011d8d8b497a58f',
  'eea9e3f390a0dd5733a7e8b6401beec7cc19520647f88d9e2fc845d539d6ade1',
  'f3f9aa2cd9cdf9d8615b4871fb91887f34f23aae6df7493c5bd0c9118f792835',
  'f57195c736be9ec3128886752edb423a4f57cb5572ecf66de49e90000afcb0d1'
])

export const RESERVED_USERNAME_HASH_COUNT =
  SENSITIVE_RESERVED_USERNAME_HASHES.size

export const hashReservedUsername = (name: string) =>
  createHash('sha256').update(normalizeReservedUsername(name)).digest('hex')

// hashes 参数只为让测试能在不写明文词的前提下覆盖摘要匹配分支
export const isSensitiveReservedUsername = (
  name: string,
  hashes: ReadonlySet<string> = SENSITIVE_RESERVED_USERNAME_HASHES
) => hashes.has(hashReservedUsername(name))

export const isReservedUsernameStrict = (name: string) =>
  isReservedUsername(name) || isSensitiveReservedUsername(name)
