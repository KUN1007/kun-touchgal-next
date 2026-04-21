import type { Patch } from '~/types/api/patch'

const getPlatformDescription = (platform: string[]) => {
  const hasWindows = platform.includes('windows')
  const hasAndroid = platform.includes('android')

  if (hasWindows && hasAndroid) {
    return 'PC + 安卓'
  }
  if (hasWindows) {
    return 'PC 游戏'
  }
  if (hasAndroid) {
    return '安卓游戏'
  }

  return ''
}

export const getPatchPageTitle = (
  patch: Pick<Patch, 'alias' | 'name' | 'platform'>
) => {
  const patchType = getPlatformDescription(patch.platform)

  return patch.alias.length
    ? `${patch.name} | ${patch.alias[0]} | ${patchType}`
    : `${patch.name} | ${patchType}`
}
