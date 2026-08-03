import {
  registerSchema,
  sendRegisterEmailVerificationCodeSchema
} from '~/validations/auth'
import { usernameSchema } from '~/validations/user'
import {
  isReservedUsername,
  reservedUsernameMessage
} from '~/constants/reserved-usernames.server'

// 上面这些 schema 被客户端表单复用, 只做长度和格式校验; 保留用户名表只存在于
// 服务端, 所以凡是接收用户名的服务端入口都必须用这里的版本, 由它补上那一层。
export const registerServerSchema = registerSchema.refine(
  (data) => !isReservedUsername(data.name),
  { path: ['name'], message: reservedUsernameMessage }
)

export const sendRegisterEmailVerificationCodeServerSchema =
  sendRegisterEmailVerificationCodeSchema.refine(
    (data) => !isReservedUsername(data.name),
    { path: ['name'], message: reservedUsernameMessage }
  )

export const usernameServerSchema = usernameSchema.refine(
  (data) => !isReservedUsername(data.username),
  { path: ['username'], message: reservedUsernameMessage }
)

// 管理端改用户信息不在这里加 refine: 那是整表单提交, name 恒定携带, schema 层
// 判词会锁死库里存量的保留名用户。校验落在 app/api/admin/user/update.ts 的改名分支
