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

export const Tags = ({ patch }: PatchHeaderProps) => {
  return (
    <>
      {patch.platform.length > 0 &&
        patch.platform.map((platform) => (
          <span key={platform} className={`${tagClass} ${tagColors.secondary}`}>
            {SUPPORTED_PLATFORM_MAP[platform]}
          </span>
        ))}

      {patch.language.length > 0 &&
        patch.language.map((language) => (
          <span key={language} className={`${tagClass} ${tagColors.primary}`}>
            {SUPPORTED_LANGUAGE_MAP[language]}
          </span>
        ))}

      {patch.type.length > 0 &&
        patch.type.map((type) => (
          <span key={type} className={`${tagClass} ${tagColors.solidPrimary}`}>
            {SUPPORTED_TYPE_MAP[type]}
          </span>
        ))}
    </>
  )
}
