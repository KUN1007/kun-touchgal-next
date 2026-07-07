import { randomBytes } from 'crypto'
import { z } from 'zod'
import { prisma } from '~/prisma/index'
import type {
  oidcClientCreateSchema,
  oidcClientUpdateSchema
} from '~/validations/oidc'
import type { AdminOidcClient } from '~/types/api/oidc'

export const getOidcClients = async (): Promise<AdminOidcClient[]> => {
  return prisma.oidc_client.findMany({ orderBy: { created: 'desc' } })
}

export const createOidcClient = async (
  input: z.infer<typeof oidcClientCreateSchema>
) => {
  return prisma.oidc_client.create({
    data: {
      client_id: `touchgal_${randomBytes(8).toString('hex')}`,
      client_secret: randomBytes(32).toString('base64url'),
      client_name: input.client_name,
      redirect_uris: input.redirect_uris,
      post_logout_redirect_uris: input.post_logout_redirect_uris,
      scopes: input.scopes,
      grant_types: input.grant_types,
      response_types: ['code'],
      token_endpoint_auth_method: input.token_endpoint_auth_method,
      is_first_party: input.is_first_party
    }
  })
}

export const updateOidcClient = async (
  input: z.infer<typeof oidcClientUpdateSchema>
) => {
  const { id, ...rest } = input
  return prisma.oidc_client.update({
    where: { id },
    data: {
      client_name: rest.client_name,
      redirect_uris: rest.redirect_uris,
      post_logout_redirect_uris: rest.post_logout_redirect_uris,
      scopes: rest.scopes,
      grant_types: rest.grant_types,
      token_endpoint_auth_method: rest.token_endpoint_auth_method,
      is_first_party: rest.is_first_party,
      disabled: rest.disabled
    }
  })
}

export const deleteOidcClient = async (id: number) => {
  await prisma.oidc_client.delete({ where: { id } })
  return {}
}
