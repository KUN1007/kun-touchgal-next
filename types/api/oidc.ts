export interface AdminOidcClient {
  id: number
  client_id: string
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

// 仅创建响应携带明文 client_secret，一次性展示给管理员；列表 / 更新一律不返回。
export interface AdminOidcClientWithSecret extends AdminOidcClient {
  client_secret: string
}
