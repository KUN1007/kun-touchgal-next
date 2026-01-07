import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { kunParsePostBody } from '~/app/api/utils/parseQuery'
import { fetchDlsiteData } from '../dlsite'

const dlsiteSchema = z.object({
  code: z.string().regex(/^RJ\d+$/i, 'DLSite Code 格式不正确')
})

export const POST = async (req: NextRequest) => {
  const input = await kunParsePostBody(req, dlsiteSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }

  try {
    const data = await fetchDlsiteData(input.code)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch DLsite data:', error)
    return NextResponse.json('DLSite API 请求失败, 请稍后重试')
  }
}
