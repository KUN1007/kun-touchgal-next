import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// 必填关系不写 onDelete 时 Prisma 默认 Restrict; deleteUser 事务内无兜底清理,
// 删除有粉丝的用户会在 following_id 外键上抛 P2003 直接 500, 级联是唯一防线
const schema = readFileSync(
  fileURLToPath(new URL('../schema/user.prisma', import.meta.url)),
  'utf8'
)

describe('user_follow_relation onDelete', () => {
  it.each(['follower', 'following'])(
    '%s relation declares onDelete: Cascade',
    (relation) => {
      const line = schema
        .split('\n')
        .find((l) => l.includes(`fields: [${relation}_id]`))
      expect(line).toBeDefined()
      expect(line).toContain('onDelete: Cascade')
    }
  )
})
