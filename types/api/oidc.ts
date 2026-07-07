export interface AdminOidcClient {
  id: number
  client_id: string
  client_secret: string
  client_name: string
  redirect_uris: string[]
  post_logout_redirect_uris: string[]
  grant_types: string[]
  response_types: string[]
  scopes: string[]
  token_endpoint_auth_method: string
  is_first_party: boolean
  disabled: boolean
  created: Date
  updated: Date
}
