import { prisma } from '~/prisma/index'
import { encryptClientSecret, isEncryptedClientSecret } from '~/lib/oidc/secret'

// 一次性幂等脚本：把历史明文 oidc_client.client_secret 就地加密为 `gcm:` 格式，
// 使一次 DB 读泄露不再直接暴露可用凭据。已加密的行跳过，可重复运行。
// 运行：pnpm exec esno migration/backup/_migrateOidcClientSecrets.ts
const main = async () => {
  const rows = await prisma.oidc_client.findMany({
    select: { id: true, client_secret: true }
  })
  let migrated = 0
  for (const row of rows) {
    if (isEncryptedClientSecret(row.client_secret)) {
      continue
    }
    await prisma.oidc_client.update({
      where: { id: row.id },
      data: { client_secret: encryptClientSecret(row.client_secret) }
    })
    migrated += 1
  }
  console.log(
    `OIDC client_secret 迁移完成：共 ${rows.length} 行，加密 ${migrated} 行，跳过 ${rows.length - migrated} 行`
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
