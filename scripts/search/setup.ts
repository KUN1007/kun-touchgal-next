import { execSync } from 'child_process'

const runCommand = (command: string) => {
  console.log(`\n$ ${command}`)
  execSync(command, { stdio: 'inherit' })
}

try {
  runCommand('pnpm search:engine')
  runCommand('pnpm search:init')
  runCommand('pnpm search:sync-all')
  console.log('\n搜索引擎与索引已就绪，可打开 KUN_MEILISEARCH_ENABLED 灰度查询路径')
} catch (error) {
  console.error(error)
  process.exit(1)
}
