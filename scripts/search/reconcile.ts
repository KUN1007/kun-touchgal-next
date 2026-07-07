import 'dotenv/config'
import { reconcileSearchIndex } from '~/server/search/reconcile'

reconcileSearchIndex()
  .then((result) => {
    console.log(
      `对账完成: PG 共 ${result.total} 条，重新同步 ${result.synced} 条，删除 ${result.deleted} 条`
    )
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
