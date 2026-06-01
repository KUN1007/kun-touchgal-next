import { NextRequest, NextResponse } from 'next/server'
import { kunParseGetQuery } from '../utils/parseQuery'
import { resourceSchema } from '~/validations/resource'
import { getPatchVisibilityWhere } from '~/app/api/utils/getPatchVisibilityWhere'
import { getPatchResource } from './service'

export const GET = async (req: NextRequest) => {
  const input = kunParseGetQuery(req, resourceSchema)
  if (typeof input === 'string') {
    return NextResponse.json(input)
  }
  const visibilityWhere = await getPatchVisibilityWhere(req)

  const response = await getPatchResource(input, visibilityWhere)
  return NextResponse.json(response)
}
