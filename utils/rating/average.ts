export const calcOneDecimalAverage = (
  values: Array<number | null | undefined>
) => {
  if (!values || values.length === 0) {
    return 0
  }
  const nums = values.filter(
    (v): v is number => typeof v === 'number' && !Number.isNaN(v)
  )
  if (nums.length === 0) {
    return 0
  }
  const avg = nums.reduce((s, n) => s + n, 0) / nums.length
  return Math.round(avg * 10) / 10
}

export const roundOneDecimal = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0
  }
  return Math.round(value * 10) / 10
}
