export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.KUN_ENABLE_CRON === 'true'
  ) {
    const { setKUNGalgameTask } = await import('./server/cron')
    await setKUNGalgameTask()
  }
}
