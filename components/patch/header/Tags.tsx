import {
  SUPPORTED_LANGUAGE_MAP,
  SUPPORTED_PLATFORM_MAP,
  SUPPORTED_TYPE_MAP
} from '~/constants/resource'
import type { Patch } from '~/types/api/patch'

const tagClass =
  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium'

const tagColors = {
  secondary: 'bg-secondary-100 text-secondary-600',
  primary: 'bg-primary-100 text-primary-600',
  solidPrimary: 'bg-primary text-primary-foreground'
}

interface PatchHeaderProps {
  patch: Patch
}

// 平台 chip 按展示目标聚合: 模拟器 -> Android/iOS, APK -> Android, IPA -> iOS
const DISPLAY_PLATFORM_MAP: Record<string, string[]> = {
  windows: ['windows'],
  macos: ['macos'],
  linux: ['linux'],
  emulator: ['android', 'ios'],
  apk: ['android'],
  ipa: ['ios'],
  other: ['other']
}

const DISPLAY_PLATFORM_LABEL: Record<string, string> = {
  ...SUPPORTED_PLATFORM_MAP,
  android: 'Android',
  ios: 'iOS'
}

const resolveDisplayPlatforms = (platforms: string[]) => [
  ...new Set(platforms.flatMap((p) => DISPLAY_PLATFORM_MAP[p] ?? []))
]

export const Tags = ({ patch }: PatchHeaderProps) => {
  const displayPlatforms = resolveDisplayPlatforms(patch.platform)
  const sortedLanguages = [...patch.language].sort(
    (a, b) => Number(a === 'other') - Number(b === 'other')
  )

  return (
    <>
      {displayPlatforms.map((platform) => (
        <span key={platform} className={`${tagClass} ${tagColors.secondary}`}>
          {DISPLAY_PLATFORM_LABEL[platform]}
        </span>
      ))}

      {sortedLanguages.map((language) => (
        <span key={language} className={`${tagClass} ${tagColors.primary}`}>
          {SUPPORTED_LANGUAGE_MAP[language]}
        </span>
      ))}

      {patch.type.map((type) => (
        <span key={type} className={`${tagClass} ${tagColors.solidPrimary}`}>
          {SUPPORTED_TYPE_MAP[type]}
        </span>
      ))}
    </>
  )
}
