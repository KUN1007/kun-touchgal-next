import { prisma } from '~/prisma/index'
import {
  COMMENT_HTML_VERSION,
  renderCommentHtml
} from '~/app/api/utils/render/markdownToHtmlComment'

const BATCH_SIZE = 200

const backfillCommentHtml = async () => {
  let processed = 0
  let failed = 0
  let cursorId = 0

  while (true) {
    const batch = await prisma.patch_comment.findMany({
      where: {
        content_html_version: { not: COMMENT_HTML_VERSION },
        id: { gt: cursorId }
      },
      select: { id: true, content: true },
      take: BATCH_SIZE,
      orderBy: { id: 'asc' }
    })

    if (batch.length === 0) {
      break
    }

    for (const row of batch) {
      try {
        const html = await renderCommentHtml(row.content)
        await prisma.patch_comment.update({
          where: { id: row.id },
          data: {
            content_html: html,
            content_html_version: COMMENT_HTML_VERSION
          }
        })
        processed++
      } catch (error) {
        failed++
        console.error(`[backfill] comment ${row.id} failed:`, error)
      }
      cursorId = row.id
    }

    console.log(
      `[backfill] cursor=${cursorId}, processed=${processed}, failed=${failed}`
    )
  }

  console.log(
    `[backfill] complete. total processed=${processed}, failed=${failed}`
  )
}

backfillCommentHtml()
  .catch((error) => {
    console.error('[backfill] fatal:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
