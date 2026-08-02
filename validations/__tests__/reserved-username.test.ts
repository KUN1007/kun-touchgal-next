import { describe, expect, it } from 'vitest'
import {
  isReservedUsername,
  RESERVED_USERNAMES
} from '~/constants/reserved-usernames'
import {
  registerSchema,
  sendRegisterEmailVerificationCodeSchema,
  loginSchema
} from '~/validations/auth'
import { usernameSchema } from '~/validations/user'
import { adminUpdateUserSchema } from '~/validations/admin'

describe('isReservedUsername 精确匹配', () => {
  it('大小写不敏感地命中保留词', () => {
    expect(isReservedUsername('touchgal')).toBe(true)
    expect(isReservedUsername('TouchGal')).toBe(true)
    expect(isReservedUsername('TOUCHGAL')).toBe(true)
    expect(isReservedUsername('palentum')).toBe(true)
    expect(isReservedUsername('admin')).toBe(true)
    expect(isReservedUsername('***')).toBe(true)
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
})

describe('sendRegisterEmailVerificationCodeSchema 保留词校验', () => {
  it('拒绝保留词用户名', () => {
    const result = sendRegisterEmailVerificationCodeSchema.safeParse({
      name: 'touchgal',
      email: 'kun@qq.com',
      captcha: '0123456789abcdef0123456789abcdef'
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['name'])
      expect(result.error.issues[0].message).toBe(
        '该用户名已被系统保留，请更换'
      )
    }
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
