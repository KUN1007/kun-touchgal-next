import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// 服务端字面量泄漏进 client chunk 已经发生过两次 (保留用户名词表、审核 prompt
// 原文)。上一版防线只扫 'use client' 文件本身与 validations/*, 中间层是盲区:
// 审核 prompt 就是经 constants/moderation.ts 这一跳进的 chunk——那份文件的 label
// 表有四个客户端组件在用。所以这里从 'use client' 出发沿 import 边做传递闭包,
// 任意深度引用 server/** 或 *.server.ts 都会红, 并打印完整链路。
const repoRoot = fileURLToPath(new URL('../', import.meta.url))

const listSourceFiles = (dir: string) =>
  readdirSync(join(repoRoot, dir), { recursive: true, encoding: 'utf-8' })
    .filter((entry) => /\.tsx?$/.test(entry) && !entry.includes('__tests__'))
    .map((entry) => join(repoRoot, dir, entry))

const readSource = (file: string) => readFileSync(file, { encoding: 'utf-8' })

// import type / export type 整句会被 TS 完全擦除 (tsconfig 无
// verbatimModuleSyntax), 不产生运行时依赖。不排除的话, 客户端组件里那几条
// `import type { PatchResourceDetail } from '~/app/api/patch/resource/detail'`
// 会把整片 app/api 拉进闭包, 满屏误报。
// `import { type A, B }` 不在此列——B 是值导入, 模块照样进 bundle。
//
// 语句体那段负向前瞻不可省: 项目是无分号风格, 用 `[^;]*?` 之类的宽字符类会让
// `export const X = {...}` 一路吃到下一条 `import type ... from`, 把 type-only
// 语句误算成值导入 (假阳性), 反过来 `export type Foo = {...}` 起头也能吞掉紧随
// 其后的真实值导入 (假阴性)。锚在行首、禁止跨越新的 import/export 行才准确。
const STATIC_IMPORT =
  /^[ \t]*(?:import|export)(\s+type\b)?(?:(?!^[ \t]*(?:import|export)\b)[\s\S])*?\sfrom\s*['"]([^'"]+)['"]/gm
const BARE_IMPORT = /^[ \t]*import\s*['"]([^'"]+)['"]/gm
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

const collectSpecifiers = (source: string) => {
  const specifiers: string[] = []
  for (const match of source.matchAll(STATIC_IMPORT)) {
    if (match[1]) {
      continue
    }
    specifiers.push(match[2])
  }
  for (const match of source.matchAll(BARE_IMPORT)) {
    specifiers.push(match[1])
  }
  for (const match of source.matchAll(DYNAMIC_IMPORT)) {
    specifiers.push(match[1])
  }
  return specifiers
}

// 只补全 .ts / .tsx / index。刻意不解析 .d.ts: 声明文件不产生运行时代码,
// `import { KunTreeNode } from '~/lib/mdx/types'` 这类值导入语法引类型的写法
// 解析为 null 跳过才是对的。裸包名 (node_modules) 同样跳过。
const resolveSpecifier = (specifier: string, fromFile: string) => {
  let base: string
  if (specifier.startsWith('~/')) {
    base = join(repoRoot, specifier.slice(2))
  } else if (specifier.startsWith('.')) {
    base = resolve(dirname(fromFile), specifier)
  } else {
    return null
  }

  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx')
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate
    }
  }
  return null
}

const isServerModule = (file: string) => {
  const rel = relative(repoRoot, file)
  return rel.startsWith('server/') || /\.server\.tsx?$/.test(rel)
}

const clientEntries = [
  ...listSourceFiles('components'),
  ...listSourceFiles('app')
].filter((file) => /^\s*(['"])use client\1/.test(readSource(file)))

const closure = new Set(clientEntries)
const violations: string[] = []
const parent = new Map<string, string>()
const queue = [...clientEntries]

const describeChain = (file: string) => {
  const chain = [file]
  let cursor = parent.get(file)
  while (cursor) {
    chain.unshift(cursor)
    cursor = parent.get(cursor)
  }
  return chain.map((entry) => relative(repoRoot, entry)).join('\n    → ')
}

while (queue.length) {
  const current = queue.shift()!
  for (const specifier of collectSpecifiers(readSource(current))) {
    const resolved = resolveSpecifier(specifier, current)
    if (!resolved || closure.has(resolved)) {
      continue
    }
    parent.set(resolved, current)
    if (isServerModule(resolved)) {
      violations.push(describeChain(resolved))
      continue
    }
    closure.add(resolved)
    queue.push(resolved)
  }
}

// collectSpecifiers 是整道防线的承重件: 它漏掉一种 import 写法, 上面的闭包就
// 静默少一条边, 而测试照样全绿。这些用例把每种写法钉死。
describe('import 提取', () => {
  it('抓得到各种值导入写法', () => {
    expect(
      collectSpecifiers(
        [
          `import Kun from '~/a'`,
          `import * as ns from '~/b'`,
          `import { c, d as e } from '~/c'`,
          `import '~/d'`,
          `export { f } from '~/e'`,
          `export * from '~/f'`,
          `const g = await import('~/g')`
        ].join('\n')
      )
    ).toEqual(['~/a', '~/b', '~/c', '~/e', '~/f', '~/d', '~/g'])
  })

  it('抓得到跨行的 import', () => {
    expect(collectSpecifiers("import {\n  a,\n  b\n} from '~/a'")).toEqual([
      '~/a'
    ])
  })

  // 整句 type-only 才擦除; 混合写法里的 b 是值导入, 模块照进 bundle
  it('排除整句 type-only, 保留内联 type 的混合写法', () => {
    expect(collectSpecifiers(`import type { a } from '~/a'`)).toEqual([])
    expect(collectSpecifiers(`export type { a } from '~/a'`)).toEqual([])
    expect(collectSpecifiers(`import { type a, b } from '~/a'`)).toEqual([
      '~/a'
    ])
  })

  // 无分号风格下语句边界只能靠行首锚定, 这两条是回归用例
  it('不跨语句吞并相邻的 import', () => {
    expect(
      collectSpecifiers(
        `export const a = {\n  b: 1\n}\nimport type { c } from '~/a'`
      )
    ).toEqual([])
    expect(
      collectSpecifiers(
        `export type A = {\n  b: string\n}\nimport { c } from '~/a'`
      )
    ).toEqual(['~/a'])
  })
})

// 浅层扫描: 闭包只覆盖当前被引用到的模块, 而 validations 下的 schema 随时会被
// 新的客户端表单接上。这一层不等它被引用就先约束住, 与闭包互补。
describe('客户端可达模块不得引用服务端模块', () => {
  const serverImportPattern = /from\s+['"][^'"]*\.server['"]/
  const serverDirImportPattern = /from\s+['"](?:~\/|(?:\.\.\/)+)server\//

  // validations 下除 *.server.ts 外的模块都可能被客户端 schema 复用
  const sharedValidations = listSourceFiles('validations').filter(
    (file) => !file.endsWith('.server.ts')
  )

  it('扫描面非空, 防止 glob 写错后静默全绿', () => {
    expect(sharedValidations.length).toBeGreaterThan(10)
  })

  it.each(
    [...clientEntries, ...sharedValidations].map((file) =>
      relative(repoRoot, file)
    )
  )('%s 不引用服务端模块', (file) => {
    const source = readSource(join(repoRoot, file))
    expect(source).not.toMatch(serverImportPattern)
    expect(source).not.toMatch(serverDirImportPattern)
  })
})

describe('客户端模块图不得触达服务端模块', () => {
  it('传递闭包内无服务端模块', () => {
    expect(violations).toEqual([])
  })

  // 别名解析写错时每条边都会 resolve 成 null, 闭包缩成起点集, 违规恒为空——
  // 静默全绿比漏报更糟, 下面三条断言就是为了让那种情况炸出来。
  // 比的是"闭包比起点集多出多少", 不是绝对值: `~/` 分支失效时相对路径仍在工作,
  // 闭包只掉到 260 + 46, 用绝对阈值照样蒙混过关 (实测)。当前是 260 + 123。
  it('闭包显著大于起点集, 说明确实沿 import 边走了下去', () => {
    expect(clientEntries.length).toBeGreaterThan(200)
    expect(closure.size).toBeGreaterThan(clientEntries.length + 80)
  })

  it('闭包含已知的中间层模块, 证明 ~/ 别名解析生效', () => {
    // 前者是审核 prompt 泄漏的那一跳, 后者是所有客户端请求的必经模块
    expect(closure).toContain(join(repoRoot, 'constants/moderation.ts'))
    expect(closure).toContain(join(repoRoot, 'utils/kunFetch.ts'))
  })

  it('相对路径解析生效', () => {
    expect(resolveSpecifier('./kunFetch', join(repoRoot, 'utils/x.ts'))).toBe(
      join(repoRoot, 'utils/kunFetch.ts')
    )
  })
})
