'use client'

import type { VNDBResponse } from '~/components/edit/VNDB'

const buildAllTitles = (response: VNDBResponse) => {
  return response.results.flatMap((vn) => {
    const jaTitle = vn.titles.find((t) => t.lang === 'ja')?.title
    const titlesArray = [
      ...(jaTitle ? [jaTitle] : []),
      vn.title,
      ...vn.titles.filter((t) => t.lang !== 'ja').map((t) => t.title),
      ...vn.aliases
    ]
    return titlesArray
  })
}

export const fetchVNDBDetails = async (
  vnId: string
): Promise<{ titles: string[]; released: string }> => {
  const vndbResponse = await fetch(`https://api.vndb.org/kana/vn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filters: ['id', '=', vnId],
      fields: 'title, titles.lang, titles.title, aliases, released'
    })
  })

  if (!vndbResponse.ok) {
    throw new Error('VNDB_API_ERROR')
  }

  const vndbData: VNDBResponse = await vndbResponse.json()
  if (!vndbData.results.length) {
    throw new Error('VNDB_NOT_FOUND')
  }

  const titles = buildAllTitles(vndbData)
  const released = vndbData.results[0].released

  return { titles, released }
}
