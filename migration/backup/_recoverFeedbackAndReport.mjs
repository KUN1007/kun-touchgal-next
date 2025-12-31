import { prisma } from '~/prisma/index'

const extractGameNameString = (text) => {
  const startMarker = '游戏: '
  const endMarker = ' 提交了一个反馈'

  const startIndex = text.indexOf(startMarker)
  if (startIndex === -1) {
    return ''
  }

  const contentStartIndex = startIndex + startMarker.length

  const endIndex = text.indexOf(endMarker, contentStartIndex)
  if (endIndex === -1) {
    return ''
  }

  const result = text.slice(contentStartIndex, endIndex)

  return result.trim()
}

const recoverFeedbackAndReport = async () => {
  const messages = await prisma.user_message.findMany({
    where: {
      OR: [{ type: 'feedback' }, { type: 'report' }]
    }
  })

  const msgArray = messages.map((msg) => ({
    id: msg.id,
    gameName: extractGameNameString(msg.content)
  }))

  let count = 0
  for (const msg of msgArray) {
    count++
    const resource = await prisma.patch.findFirst({
      where: { name: msg.gameName },
      select: { unique_id: true }
    })
    if (!resource) {
      continue
    } else {
      await prisma.user_message.update({
        where: { id: msg.id },
        data: { link: `/${resource.unique_id}` }
      })
    }
  }

  console.log(`${count} feedbacks and reports recovered successfully!`)
}

recoverFeedbackAndReport()
