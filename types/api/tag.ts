export interface Tag {
  id: number
  name: string
  count: number
  alias: string[]
}

export interface TagDetail extends Tag {
  introduction: string
  created: string | Date
  user: KunUser
}
