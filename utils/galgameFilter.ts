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

// 年份与月份在 buildGalgameDateFilter 中做笛卡尔积, 元素数量无上限时
// 单个请求可展开出数万个 LIKE 谓词。年份选项为 all/future/unknown +
// (当前年 - 1979), 2026 年共 50 项且每年 +1, 月份选项 13 项, 64 覆盖两者
export const MAX_GALGAME_FILTER_VALUES = 64

const isStringArray = (value: unknown): value is string[] => {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' && item.length > 0)
  )
}

// 服务端 schema 用它对「合法字符串数组但元素数越界」硬拒, 对齐 /api/search
// 的 z.array().max; 畸形载荷返回 false, 仍由 parseGalgameFilterArray 回落容错
export const exceedsGalgameFilterLimit = (value: string) => {
  try {
    const parsed = JSON.parse(value)
    return isStringArray(parsed) && parsed.length > MAX_GALGAME_FILTER_VALUES
  } catch {
    return false
  }
}

export const parseGalgameFilterArray = (value: string | null | undefined) => {
  if (!value) {
    return [...DEFAULT_GALGAME_FILTER_SELECTION]
  }

  try {
    const parsed = JSON.parse(value)

    return isStringArray(parsed) && parsed.length <= MAX_GALGAME_FILTER_VALUES
      ? parsed
      : [...DEFAULT_GALGAME_FILTER_SELECTION]
  } catch {
    return [...DEFAULT_GALGAME_FILTER_SELECTION]
  }
}

// 上界与 validations 各 schema 对齐 (page: max(9999999),
// minRatingCount: max(999999)); 越界回落而非透传, 否则 SSR 入口
// 会被 schema 硬拒, 渲染整页错误而非回落默认值
export const MAX_PAGE_PARAM = 9999999
export const MAX_MIN_RATING_COUNT_PARAM = 999999

export const parsePositiveIntParam = (
  value: string | null | undefined,
  fallback: number
) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_PAGE_PARAM) {
    return fallback
  }

  return Math.floor(parsed)
}

export const parseNonNegativeIntParam = (
  value: string | null | undefined,
  fallback: number
) => {
  const parsed = Number(value)
  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > MAX_MIN_RATING_COUNT_PARAM
  ) {
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
