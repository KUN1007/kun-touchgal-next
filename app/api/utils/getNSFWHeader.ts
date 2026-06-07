import { parseCookies } from '~/utils/cookies'
import {
  KUN_AUTH_TOKEN_COOKIE,
  KUN_NSFW_SETTING_COOKIE,
  SFW_NSFW_HEADER,
  getAuthenticatedNSFWHeader,
  isRestrictedNSFWSetting,
  type NsfwHeader
} from '~/utils/nsfwHeader'
import { verifyKunToken, type KunGalgamePayload } from './jwt'
import type { NextRequest } from 'next/server'

export const getNSFWHeader = async (
  req: NextRequest,
  payload?: KunGalgamePayload | null
): Promise<NsfwHeader> => {
  const cookies = parseCookies(req.headers.get('cookie') ?? '')
  const token = cookies[KUN_NSFW_SETTING_COOKIE]
  if (!isRestrictedNSFWSetting(token)) {
    return SFW_NSFW_HEADER
  }

  const verifiedPayload =
    payload === undefined
      ? await verifyKunToken(cookies[KUN_AUTH_TOKEN_COOKIE] ?? '')
      : payload

  if (!verifiedPayload) {
    return SFW_NSFW_HEADER
  }

  return getAuthenticatedNSFWHeader(token)
}
