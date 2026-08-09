// TODO: type
// type SelectFieldKey = Exclude<keyof GalgameCard, '_count'> & {
//   select: {
//     favorite_by: boolean
//     resource: boolean
//     comment: boolean
//   }
// }

export const PatchRefSelectField = {
  unique_id: true,
  name: true
}

export const GalgameCardSelectField = {
  id: true,
  unique_id: true,
  name: true,
  banner: true,
  view: true,
  download: true,
  type: true,
  language: true,
  platform: true,
  created: true,
  favorite_count: true,
  resource_count: true,
  comment_count: true,
  rating_stat: {
    select: {
      avg_overall: true
    }
  }
}

type GalgameCardCountShape = {
  favorite_folder: number
  resource: number
  comment: number
}

interface GalgameCardCounters {
  favorite_count: number
  resource_count: number
  comment_count: number
}

export const toGalgameCardCount = (
  row: GalgameCardCounters
): GalgameCardCountShape => ({
  favorite_folder: row.favorite_count,
  resource: row.resource_count,
  comment: row.comment_count
})
