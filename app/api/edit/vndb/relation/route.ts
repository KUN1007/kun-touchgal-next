import { NextRequest, NextResponse } from 'next/server'
import { JSDOM } from 'jsdom'
import { z } from 'zod'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'

const relationSchema = z.object({
  relationId: z.string().regex(/^r\d+$/i, 'Relation ID 格式不正确')
})

const splitCellText = (value: string | null | undefined) =>
  value
    ?.split('\n')
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length) ?? []

const findRowByLabel = (document: Document, label: string) => {
  const rows = Array.from(document.querySelectorAll('tr'))
  return (
    rows.find(
      (row) => row.querySelector('.key')?.textContent?.trim() === label
    ) ?? null
  )
}

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, relationSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  const relationId = input.relationId.toLowerCase()

  try {
    const response = await fetch(`https://vndb.org/${relationId}`)
    if (!response.ok) {
      return NextResponse.json('VNDB Release 页面获取失败')
    }

    const html = await response.text()
    const dom = new JSDOM(html)
    const { document } = dom.window

    const relationRow = findRowByLabel(document, 'Relation')
    const relationHref =
      relationRow?.querySelector('a[href^="/v"]')?.getAttribute('href') ?? ''
    const relationMatch = relationHref.match(/(v\d+)/i)
    if (!relationMatch) {
      return NextResponse.json('未能在 Release 页面找到关联的 VN ID')
    }

    const titleCell = findRowByLabel(document, 'Title')?.querySelector(
      'td:nth-of-type(2)'
    )
    const releaseCell = findRowByLabel(document, 'Released')?.querySelector(
      'td:nth-of-type(2)'
    )

    const titles = splitCellText(titleCell?.textContent)
    const released = splitCellText(releaseCell?.textContent)[0] ?? ''

    return NextResponse.json({
      vndbId: relationMatch[1].toLowerCase(),
      titles,
      released
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json('VNDB Release 页面获取失败')
  }
}
