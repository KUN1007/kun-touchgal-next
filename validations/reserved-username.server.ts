import {
  registerSchema,
  sendRegisterEmailVerificationCodeSchema
} from '~/validations/auth'
import { usernameSchema } from '~/validations/user'
import { adminUpdateUserSchema } from '~/validations/admin'
import { reservedUsernameMessage } from '~/constants/reserved-usernames'
import { isSensitiveReservedUsername } from '~/constants/reserved-usernames.server'

// 上面这些 schema 被客户端表单复用, 只能校验公开保留词; 敏感词摘要表仅存在于
// 服务端, 所以凡是接收用户名的服务端入口都必须用这里的版本, 由它补上那一层。
export const registerServerSchema = registerSchema.refine(
  (data) => !isSensitiveReservedUsername(data.name),
  { path: ['name'], message: reservedUsernameMessage }
)

export const sendRegisterEmailVerificationCodeServerSchema =
  sendRegisterEmailVerificationCodeSchema.refine(
    (data) => !isSensitiveReservedUsername(data.name),
    { path: ['name'], message: reservedUsernameMessage }
  )

export const usernameServerSchema = usernameSchema.refine(
  (data) => !isSensitiveReservedUsername(data.username),
  { path: ['username'], message: reservedUsernameMessage }
)

export const adminUpdateUserServerSchema = adminUpdateUserSchema.refine(
  (data) => !isSensitiveReservedUsername(data.name),
  { path: ['name'], message: reservedUsernameMessage }
)
