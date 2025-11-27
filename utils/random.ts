export const randomNum = (lowerValue: number, upperValue: number) => {
  return Math.floor(Math.random() * (upperValue - lowerValue + 1) + lowerValue)
}

export const randomNormalInt = (min: number, max: number) => {
  const mean = (min + max) / 2
  const stdDev = (max - min) / 6

  const weights = []
  for (let x = min; x <= max; x++) {
    const w = Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2))
    weights.push(w)
  }

  const sum = weights.reduce((a, b) => a + b, 0)
  const r = Math.random() * sum

  let accum = 0
  for (let i = 0; i < weights.length; i++) {
    accum += weights[i]
    if (r <= accum) return min + i
  }
}

export const generateRandomString = (length: number) => {
  const charset = '023456789abcdefghjkmnopqrstuvwxyz'
  let code = ''
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length)
    code += charset[randomIndex]
  }
  return code.toUpperCase()
}
