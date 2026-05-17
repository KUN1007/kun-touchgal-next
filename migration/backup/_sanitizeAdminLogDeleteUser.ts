import { prisma } from '../prisma'

// One-shot cleanup for admin_log records produced by the legacy
// app/api/admin/user/delete.ts, which serialized the entire user row
// (including password hash, TOTP secret, backup codes, ip) into content.
//
// Old format: `管理员 <name> 删除了一个用户\n\n<JSON.stringify(user)>`
// We rebuild the JSON to only the audit-safe fields the fixed code keeps.

const ALLOWED_FIELDS = ['id', 'name', 'email', 'role', 'status'] as const
const SEPARATOR = '\n\n'
const PAGE_SIZE = 500

const run = async () => {
  let sanitized = 0
  let alreadyClean = 0
  let unparseable = 0
  let cursor: number | undefined

  while (true) {
    const page = await prisma.admin_log.findMany({
      where: { type: 'delete' },
      select: { id: true, content: true },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 })
    })
    if (page.length === 0) break

    for (const record of page) {
      const idx = record.content.indexOf(SEPARATOR)
      if (idx === -1) {
        unparseable++
        continue
      }

      const prefix = record.content.slice(0, idx + SEPARATOR.length)
      const jsonPart = record.content.slice(idx + SEPARATOR.length).trim()

      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(jsonPart)
      } catch {
        unparseable++
        continue
      }

      const cleaned: Record<string, unknown> = {}
      for (const key of ALLOWED_FIELDS) {
        if (key in parsed) {
          cleaned[key] = parsed[key]
        }
      }

      const newContent = `${prefix}${JSON.stringify(cleaned)}`
      if (newContent === record.content) {
        alreadyClean++
        continue
      }

      await prisma.admin_log.update({
        where: { id: record.id },
        data: { content: newContent }
      })
      sanitized++
    }

    cursor = page[page.length - 1].id
    if (page.length < PAGE_SIZE) break
  }

  console.log(
    `admin_log delete records — sanitized: ${sanitized}, already clean: ${alreadyClean}, unparseable: ${unparseable}`
  )
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
