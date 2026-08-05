import type { SortField, SortOrder } from '~/components/galgame/_sort'

export const DEFAULT_GALGAME_SORT_FIELD: SortField = 'resource_update_time'
export const DEFAULT_GALGAME_SORT_ORDER: SortOrder = 'desc'
export const DEFAULT_GALGAME_FILTER_VALUE = 'all'
export const DEFAULT_GALGAME_FILTER_SELECTION = ['all']
export const DEFAULT_GALGAME_YEAR_STRING = JSON.stringify(
  DEFAULT_GALGAME_FILTER_SELECTION
)
export const DEFAULT_GALGAME_MONTH_STRING = JSON.stringify(
  DEFAULT_GALGAME_FILTER_SELECTION
)
export const DEFAULT_GALGAME_MIN_RATING_COUNT = 10
export const DEFAULT_TAG_COMPANY_MIN_RATING_COUNT = 0

export const getSearchParamValue = (
  value: string | string[] | null | undefined
) => {
  return Array.isArray(value) ? value[0] : (value ?? undefined)
}

const isStringArray = (value: unknown): value is string[] => {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' && item.length > 0)
  )
}

export const parseGalgameFilterArray = (value: string | null | undefined) => {
  if (!value) {
    return [...DEFAULT_GALGAME_FILTER_SELECTION]
  }

  try {
    const parsed = JSON.parse(value)

    return isStringArray(parsed)
      ? parsed
      : [...DEFAULT_GALGAME_FILTER_SELECTION]
  } catch {
    return [...DEFAULT_GALGAME_FILTER_SELECTION]
  }
}

export const parsePositiveIntParam = (
  value: string | null | undefined,
  fallback: number
) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return Math.floor(parsed)
}

export const parseNonNegativeIntParam = (
  value: string | null | undefined,
  fallback: number
) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }

  return Math.floor(parsed)
}

// debounced 筛选 (评分人数阈值) 不重置页码, 收紧后页码可能越界;
// 响应到达时判定并重置到第 1 页自愈。
// page > 1 保证至多触发一次, 不会因 total 与列表不一致而循环
export const kunShouldResetOverflowPage = (
  total: number,
  listLength: number,
  page: number
) => {
  return total > 0 && listLength === 0 && page > 1
}
