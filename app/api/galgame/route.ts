import { NextRequest, NextResponse } from 'next/server'
import { kunParseGetQuery } from '../utils/parseQuery'
import { galgameSchema } from '~/validations/galgame'
import { getPatchVisibilityContext } from '~/app/api/utils/getPatchVisibilityContext'
import { getGalgame } from './service'
export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, galgameSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const visibility = await getPatchVisibilityContext(req)

  const response = await getGalgame(input, visibility)
  return NextResponse.json(response)
}
