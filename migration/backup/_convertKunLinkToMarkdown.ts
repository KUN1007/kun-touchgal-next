import { prisma } from '../prisma'

const kunLinkPattern1 = /::kun-link\{href="([^"]*)" text="([^"]*)"\}/g
const kunLinkPattern2 = /::kun-link\{text="([^"]*)" href="([^"]*)"\}/g

const convertKunLink = (content: string): string => {
  return content
    .replace(kunLinkPattern1, (_, href, text) => `[${text}](${href})`)
    .replace(kunLinkPattern2, (_, text, href) => `[${text}](${href})`)
}

const run = async () => {
  const comments = await prisma.patch_comment.findMany({
    select: { id: true, content: true }
  })

  const affected = comments.filter((c) => /::kun-link\{/.test(c.content))

  console.log(`Found ${affected.length} comments with ::kun-link directives`)

  let updated = 0
  for (const comment of affected) {
    const newContent = convertKunLink(comment.content)
    if (newContent !== comment.content) {
      await prisma.patch_comment.update({
        where: { id: comment.id },
        data: { content: newContent }
      })
      updated++
      console.log(`  Updated comment #${comment.id}`)
    }
  }

  console.log(`Done. Updated ${updated} comments.`)
}

run()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
