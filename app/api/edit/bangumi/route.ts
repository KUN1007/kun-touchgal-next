import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { BANGUMI_API_BASE, BANGUMI_HEADERS } from '~/constants/bangumi'
import { lowQualityTags } from '~/lib/bgmDirtyTag'
import { extractDevelopers, type BangumiInfoboxItem } from './_developers'

const bangumiSchema = z.object({
  bangumiId: z.string().regex(/^\d+$/, 'Bangumi ID 必须为纯数字')
})

interface BangumiTag {
  name: string
  count: number
}

interface BangumiSubject {
  name?: string
  name_cn?: string
  tags?: BangumiTag[]
  infobox?: BangumiInfoboxItem[]
}

const dirtyTagSet = new Set(lowQualityTags)

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, bangumiSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  try {
    const res = await fetch(
      `${BANGUMI_API_BASE}/v0/subjects/${input.bangumiId}`,
      { headers: BANGUMI_HEADERS }
    )
    if (!res.ok) {
      return NextResponse.json('未找到对应的 Bangumi 条目')
    }

    const data = (await res.json()) as BangumiSubject

    const tags = (data.tags ?? [])
      .filter((t) => !dirtyTagSet.has(t.name))
      .map((t) => t.name)

    const developers = extractDevelopers(data.infobox)

    return NextResponse.json({
      name: data.name ?? '',
      nameCn: data.name_cn ?? '',
      tags,
      developers
    })
  } catch (error) {
    return NextResponse.json('Bangumi API 请求失败')
  }
}
