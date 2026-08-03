import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  hashReservedUsername,
  isReservedUsername,
  RESERVED_USERNAMES,
  RESERVED_USERNAME_COUNT
} from '~/constants/reserved-usernames.server'
import {
  registerSchema,
  sendRegisterEmailVerificationCodeSchema,
  loginSchema
} from '~/validations/auth'
import { usernameSchema } from '~/validations/user'
import {
  registerServerSchema,
  sendRegisterEmailVerificationCodeServerSchema,
  usernameServerSchema
} from '~/validations/reserved-username.server'

describe('isReservedUsername 精确匹配', () => {
  it('大小写不敏感地命中明文保留词', () => {
    expect(isReservedUsername('touchgal')).toBe(true)
    expect(isReservedUsername('TouchGal')).toBe(true)
    expect(isReservedUsername('TOUCHGAL')).toBe(true)
    expect(isReservedUsername('palentum')).toBe(true)
    expect(isReservedUsername('admin')).toBe(true)
    expect(isReservedUsername('  Admin  ')).toBe(true)
  })

  it('非精确匹配不拦截', () => {
    expect(isReservedUsername('kun')).toBe(false)
    expect(isReservedUsername('palentum666')).toBe(false)
    expect(isReservedUsername('contest')).toBe(false)
    expect(isReservedUsername('')).toBe(false)
    expect(isReservedUsername('   ')).toBe(false)
  })

  it('明文条目均为小写, 保证比较语义一致', () => {
    for (const word of RESERVED_USERNAMES) {
      expect(word).toBe(word.toLowerCase())
    }
  })

  // 敏感条目只以摘要形式存在, 测试里同样不写明文, 用自造摘要集合覆盖该分支
  it('摘要命中即判定为保留词', () => {
    const hashes = new Set([hashReservedUsername('kun-probe-word')])
    expect(isReservedUsername('kun-probe-word', hashes)).toBe(true)
    expect(isReservedUsername('kun', hashes)).toBe(false)
  })

  it('摘要匹配与明文表一样折叠首尾空白和大小写', () => {
    const hashes = new Set([hashReservedUsername('kun-probe-word')])
    expect(isReservedUsername('  KUN-Probe-Word  ', hashes)).toBe(true)
  })

  // 零宽字符不改变用户名的视觉呈现, 留着就等于保留词可被逐字冒名
  it('剥离不可见格式字符后仍判定为保留词', () => {
    expect(isReservedUsername('admin​')).toBe(true) // ZWSP
    expect(isReservedUsername('admin‌')).toBe(true) // ZWNJ
    expect(isReservedUsername('ad‍min')).toBe(true) // ZWJ
    expect(isReservedUsername('admin﻿')).toBe(true) // BOM
    expect(isReservedUsername('‮admin')).toBe(true) // RLO 双向覆写
    expect(isReservedUsername('管​理​员')).toBe(true)
  })

  // '​ admin': 零宽不是空白字符, 先 trim 不动, 剥完会剩前导空格
  it('先剥离后 trim, 顺序颠倒会漏判', () => {
    expect(isReservedUsername('​ admin')).toBe(true)
    expect('​ admin'.trim().replace(/\p{Cf}/gu, '')).toBe(' admin')
  })

  it('摘要分支同样剥离不可见字符', () => {
    const hashes = new Set([hashReservedUsername('kun-probe-word')])
    expect(isReservedUsername('kun-probe​-word', hashes)).toBe(true)
  })

  it('剥离不把普通用户名误判为保留词', () => {
    // 库中存量的 emoji 组合名: 剥掉 ZWJ 后依然不是保留词
    expect(isReservedUsername('\u{1f468}‍\u{1f469}‍\u{1f466}')).toBe(false)
    expect(isReservedUsername('kun​')).toBe(false)
    expect(isReservedUsername('​')).toBe(false)
  })

  it('条目总数固定, 防止误删词条', () => {
    expect(RESERVED_USERNAME_COUNT).toBe(61)
  })
})

// 这道断言是整份词表不下发浏览器的唯一防线。node:crypto 挡不住:
// 实测让一个 'use client' 组件 import ~/validations/reserved-username.server 后
// `next build` 照常成功, Turbopack 给 node:crypto 上了 polyfill, 32 条明文 + 29 条
// 摘要连同错误消息一起进了客户端 chunk。所以这里扫两层——客户端组件本身, 以及被
// 它们复用的 validations 模块——任何一层引用 *.server 都会红。
describe('客户端可达模块不得引用服务端模块', () => {
  const repoRoot = new URL('../../', import.meta.url)
  const serverImportPattern = /from\s+['"][^'"]*\.server['"]/

  const listSourceFiles = (dir: string) =>
    readdirSync(new URL(dir, repoRoot), {
      recursive: true,
      encoding: 'utf-8'
    })
      .filter((entry) => /\.tsx?$/.test(entry) && !entry.includes('__tests__'))
      .map((entry) => `${dir}/${entry}`)

  const readSource = (file: string) =>
    readFileSync(new URL(file, repoRoot), { encoding: 'utf-8' })

  const clientComponents = [
    ...listSourceFiles('components'),
    ...listSourceFiles('app')
  ].filter((file) => /^\s*(['"])use client\1/.test(readSource(file)))

  // validations 下除 *.server.ts 外的模块都可能被客户端 schema 复用
  const sharedValidations = listSourceFiles('validations').filter(
    (file) => !file.endsWith('.server.ts')
  )

  it('扫描面非空, 防止 glob 写错后静默全绿', () => {
    expect(clientComponents.length).toBeGreaterThan(50)
    expect(sharedValidations.length).toBeGreaterThan(10)
  })

  it.each([...clientComponents, ...sharedValidations])(
    '%s 不引用 *.server 模块',
    (file) => {
      expect(readSource(file)).not.toMatch(serverImportPattern)
    }
  )
})

describe('客户端 schema 不校验保留词', () => {
  const registerInput = {
    name: 'admin',
    email: 'kun@qq.com',
    code: 'Abc1234',
    password: 'pass1234'
  }

  it('registerSchema 放行保留词', () => {
    expect(registerSchema.safeParse(registerInput).success).toBe(true)
  })

  it('sendRegisterEmailVerificationCodeSchema 放行保留词', () => {
    expect(
      sendRegisterEmailVerificationCodeSchema.safeParse({
        name: 'touchgal',
        email: 'kun@qq.com',
        captcha: '0123456789abcdef0123456789abcdef'
      }).success
    ).toBe(true)
  })

  it('usernameSchema 放行保留词但仍做长度校验', () => {
    expect(usernameSchema.safeParse({ username: 'TouchGal' }).success).toBe(
      true
    )
    expect(usernameSchema.safeParse({ username: '' }).success).toBe(false)
    expect(usernameSchema.safeParse({ username: 'k'.repeat(18) }).success).toBe(
      false
    )
  })

  it('loginSchema 放行保留词（旧用户与管理员改出的保留名可登录）', () => {
    expect(
      loginSchema.safeParse({
        name: 'admin',
        password: 'pass1234',
        captcha: '0123456789abcdef0123456789abcdef'
      }).success
    ).toBe(true)
  })
})

describe('服务端 schema 拦截保留词', () => {
  const registerInput = {
    name: 'kun',
    email: 'kun@qq.com',
    code: 'Abc1234',
    password: 'pass1234'
  }
  // 管理端改用户信息的保留词校验不在 schema 层 (整表单提交会锁死存量保留名
  // 用户), 落在 app/api/admin/user/update.ts 的改名分支, 由 update.test.ts 覆盖

  it('registerServerSchema 拒绝保留词, 错误定位在 name', () => {
    const result = registerServerSchema.safeParse({
      ...registerInput,
      name: 'admin'
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['name'])
      expect(result.error.issues[0].message).toBe(
        '该用户名已被系统保留，请更换'
      )
    }
    expect(registerServerSchema.safeParse(registerInput).success).toBe(true)
  })

  it('sendRegisterEmailVerificationCodeServerSchema 拒绝保留词', () => {
    const base = {
      name: 'kun',
      email: 'kun@qq.com',
      captcha: '0123456789abcdef0123456789abcdef'
    }
    expect(
      sendRegisterEmailVerificationCodeServerSchema.safeParse({
        ...base,
        name: 'touchgal'
      }).success
    ).toBe(false)
    expect(
      sendRegisterEmailVerificationCodeServerSchema.safeParse(base).success
    ).toBe(true)
  })

  it('usernameServerSchema 拒绝保留词, 大小写不敏感', () => {
    const result = usernameServerSchema.safeParse({ username: 'TouchGal' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['username'])
      expect(result.error.issues[0].message).toBe(
        '该用户名已被系统保留，请更换'
      )
    }
    expect(usernameServerSchema.safeParse({ username: 'Kun' }).success).toBe(
      true
    )
  })
})
