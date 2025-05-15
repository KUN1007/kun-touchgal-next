export type SortField =
  | 'resource_update_time'
  | 'created'
  | 'view'
  | 'download'
  | 'favorite'

// nusp type safe using
export const sortFieldLiteral = [
  'resource_update_time',
  'created',
  'view',
  'download',
  'favorite'
] as const

export type SortOrder = 'asc' | 'desc'

// nusp type safe using
export const sortOrderLiteral = ['asc', 'desc'] as const
