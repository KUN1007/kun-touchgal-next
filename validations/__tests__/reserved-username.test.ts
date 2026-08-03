import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  isReservedUsername,
  RESERVED_USERNAMES
} from '~/constants/reserved-usernames'
import {
  hashReservedUsername,
  isSensitiveReservedUsername,
  RESERVED_USERNAME_HASH_COUNT
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
  it('大小写不敏感地命中保留词', () => {
    expect(isReservedUsername('touchgal')).toBe(true)
    expect(isReservedUsername('TouchGal')).toBe(true)
    expect(isReservedUsername('TOUCHGAL')).toBe(true)
    expect(isReservedUsername('palentum')).toBe(true)
    expect(isReservedUsername('admin')).toBe(true)
  })

  it('非精确匹配不拦截', () => {
    expect(isReservedUsername('kun')).toBe(false)
    expect(isReservedUsername('palentum666')).toBe(false)
    expect(isReservedUsername('contest')).toBe(false)
    expect(isReservedUsername('')).toBe(false)
    expect(isReservedUsername('   ')).toBe(false)
  })

  it('词表条目均为小写, 保证比较语义一致', () => {
    for (const word of RESERVED_USERNAMES) {
      expect(word).toBe(word.toLowerCase())
    }
  })
})

// 敏感词只以摘要形式存在, 测试里同样不写明文, 用自造摘要集合覆盖匹配分支
describe('敏感保留词摘要匹配', () => {
  it('摘要命中即判定为保留词', () => {
    const hashes = new Set([hashReservedUsername('kun-probe-word')])
    expect(isSensitiveReservedUsername('kun-probe-word', hashes)).toBe(true)
    expect(isSensitiveReservedUsername('kun', hashes)).toBe(false)
  })

  it('摘要匹配与明文表一样折叠首尾空白和大小写', () => {
    const hashes = new Set([hashReservedUsername('kun-probe-word')])
    expect(isSensitiveReservedUsername('  KUN-Probe-Word  ', hashes)).toBe(true)
  })

  it('摘要表条目数固定, 防止误删词条', () => {
    expect(RESERVED_USERNAME_HASH_COUNT).toBe(29)
  })
})

// 这几个模块会被客户端表单 import, 一旦引入服务端词表, 整份清单就会随
// /login /register /settings/user 的 chunk 投送给任何访客
describe('客户端可达模块不得引用服务端词表', () => {
  const clientReachableFiles = [
    'constants/reserved-usernames.ts',
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

describe('registerSchema 保留词校验', () => {
  const baseInput = {
    name: 'kun',
    email: 'kun@qq.com',
    code: 'Abc1234',
    password: 'pass1234'
  }

  it('拒绝保留词用户名, 错误定位在 name', () => {
    const result = registerSchema.safeParse({ ...baseInput, name: 'admin' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['name'])
      expect(result.error.issues[0].message).toBe(
        '该用户名已被系统保留，请更换'
      )
    }
  })

  it('正常用户名通过', () => {
    expect(registerSchema.safeParse(baseInput).success).toBe(true)
  })

  it('服务端版本继承公开词校验', () => {
    expect(
      registerServerSchema.safeParse({ ...baseInput, name: 'admin' }).success
    ).toBe(false)
    expect(registerServerSchema.safeParse(baseInput).success).toBe(true)
  })
})

describe('sendRegisterEmailVerificationCodeSchema 保留词校验', () => {
  const baseInput = {
    name: 'kun',
    email: 'kun@qq.com',
    captcha: '0123456789abcdef0123456789abcdef'
  }

  it('拒绝保留词用户名', () => {
    const result = sendRegisterEmailVerificationCodeSchema.safeParse({
      ...baseInput,
      name: 'touchgal'
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['name'])
      expect(result.error.issues[0].message).toBe(
        '该用户名已被系统保留，请更换'
      )
    }
  })

  it('服务端版本继承公开词校验', () => {
    expect(
      sendRegisterEmailVerificationCodeServerSchema.safeParse({
        ...baseInput,
        name: 'touchgal'
      }).success
    ).toBe(false)
    expect(
      sendRegisterEmailVerificationCodeServerSchema.safeParse(baseInput).success
    ).toBe(true)
  })
})

describe('usernameSchema 保留词校验', () => {
  it('拒绝改为保留词用户名, 大小写不敏感', () => {
    const result = usernameSchema.safeParse({ username: 'TouchGal' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['username'])
      expect(result.error.issues[0].message).toBe(
        '该用户名已被系统保留，请更换'
      )
    }
  })

  it('普通用户名通过', () => {
    expect(usernameSchema.safeParse({ username: 'Kun' }).success).toBe(true)
  })

  it('服务端版本继承公开词校验', () => {
    expect(
      usernameServerSchema.safeParse({ username: 'TouchGal' }).success
    ).toBe(false)
    expect(usernameServerSchema.safeParse({ username: 'Kun' }).success).toBe(
      true
    )
  })
})

describe('adminUpdateUserSchema 保留词校验', () => {
  const baseInput = {
    uid: 1,
    name: 'kun',
    email: 'kun@qq.com',
    role: 1,
    status: 0,
    dailyImageCount: 0,
    moemoepoint: 0,
    bio: ''
  }

  it('拒绝把用户改名为保留词', () => {
    const result = adminUpdateUserSchema.safeParse({
      ...baseInput,
      name: 'admin'
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['name'])
      expect(result.error.issues[0].message).toBe(
        '该用户名已被系统保留，请更换'
      )
    }
  })

  it('正常改名通过', () => {
    expect(adminUpdateUserSchema.safeParse(baseInput).success).toBe(true)
  })

  it('服务端版本继承公开词校验', () => {
    expect(
      adminUpdateUserServerSchema.safeParse({ ...baseInput, name: 'admin' })
        .success
    ).toBe(false)
    expect(adminUpdateUserServerSchema.safeParse(baseInput).success).toBe(true)
  })
})

describe('loginSchema 不应校验保留词', () => {
  it('保留词用户名仍可提交登录（旧用户与管理员改出的保留名可登录）', () => {
    const result = loginSchema.safeParse({
      name: 'admin',
      password: 'pass1234',
      captcha: '0123456789abcdef0123456789abcdef'
    })
    expect(result.success).toBe(true)
  })
})
