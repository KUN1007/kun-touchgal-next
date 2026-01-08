import { z } from 'zod'
import { RANKING_SORT_FIELDS } from '~/types/api/ranking'

export const rankingSchema = z.object({
  sortField: z.enum(RANKING_SORT_FIELDS).default('rating'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  minRatingCount: z.coerce.number().min(0).max(9999).default(5),
  page: z.coerce.number().min(1).max(6).default(1),
  limit: z.coerce.number().min(1).max(50).default(50)
})
