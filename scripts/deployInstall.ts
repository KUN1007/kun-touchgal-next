import { existsSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'

const runCommand = (command: string) => {
  try {
    console.log(`Running command: ${command}`)
    execSync(command, { stdio: 'inherit' })
  } catch (error) {
    console.error(`Error running command: ${command}`)
    process.exit(1)
  }
}

runCommand('pnpm install')

runCommand('pnpm prisma:push')

if (!existsSync('./uploads')) {
  mkdirSync('./uploads')
}
runCommand('chmod 777 uploads')
