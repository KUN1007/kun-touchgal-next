import { z } from 'zod'

export const galgameSchema = z.object({
  selectedType: z.string().min(1).max(107),
  selectedLanguage: z.string().min(1).max(107),
  selectedPlatform: z.string().min(1).max(107),
  sortField: z.union([
    z.literal('resource_update_time'),
    z.literal('created'),
    z.literal('view'),
    z.literal('download'),
    z.literal('favorite'),
    z.literal('rating')
  ]),
  sortOrder: z.union([z.literal('asc'), z.literal('desc')]),
  page: z.coerce.number().min(1).max(9999999),
  limit: z.coerce.number().min(1).max(24),
  yearString: z.string().max(1007),
  monthString: z.string().max(1007),
  minRatingCount: z.coerce.number().min(0).max(999999).default(10)
})
