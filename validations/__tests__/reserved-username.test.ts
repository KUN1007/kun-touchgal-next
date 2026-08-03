import { readFileSync } from 'node:fs'
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
import { adminUpdateUserSchema } from '~/validations/admin'
import {
  adminUpdateUserServerSchema,
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

  it('条目总数固定, 防止误删词条', () => {
    expect(RESERVED_USERNAME_COUNT).toBe(61)
  })
})

// 这些模块会被客户端表单 import, 一旦引入服务端词表, 整份表就会随
// /login /register /settings/user 的 chunk 投送给任何访客
describe('客户端可达模块不得引用服务端词表', () => {
  const clientReachableFiles = [
    'validations/auth.ts',
    'validations/user.ts',
    'validations/admin.ts'
  ]

  it.each(clientReachableFiles)('%s 不引用 server 词表', (file) => {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), {
      encoding: 'utf-8'
    })
    expect(source).not.toMatch(
      /from\s+['"][^'"]*reserved-usernames\.server['"]/
    )
  })
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
  const adminInput = {
    uid: 1,
    name: 'kun',
    email: 'kun@qq.com',
    role: 1,
    status: 0,
    dailyImageCount: 0,
    moemoepoint: 0,
    bio: ''
  }

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

  it('adminUpdateUserServerSchema 拒绝把用户改名为保留词', () => {
    expect(
      adminUpdateUserServerSchema.safeParse({ ...adminInput, name: 'admin' })
        .success
    ).toBe(false)
    expect(adminUpdateUserServerSchema.safeParse(adminInput).success).toBe(true)
    expect(
      adminUpdateUserSchema.safeParse({ ...adminInput, name: 'admin' }).success
    ).toBe(true)
  })
})
