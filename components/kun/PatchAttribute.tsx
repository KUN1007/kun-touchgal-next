'use client'

import { Chip } from '@heroui/chip'
import {
  SUPPORTED_LANGUAGE_MAP,
  SUPPORTED_PLATFORM_MAP,
  SUPPORTED_TYPE_MAP
} from '~/constants/resource'

interface Props {
  types: string[]
  languages?: string[]
  platforms?: string[]
  size?: 'lg' | 'md' | 'sm'
  hidePatchType?: boolean
}

export const KunPatchAttribute = ({
  types,
  languages = [],
  platforms = [],
  size = 'md',
  hidePatchType = false
}: Props) => {
  return (
    <div className="flex flex-wrap gap-2">
      {types.map((type) =>
        hidePatchType && type === 'patch' ? null : (
          <Chip key={type} variant="flat" color="primary" size={size}>
            {SUPPORTED_TYPE_MAP[type]}
          </Chip>
        )
      )}
      {languages?.map((lang) => (
        <Chip key={lang} variant="flat" color="secondary" size={size}>
          {SUPPORTED_LANGUAGE_MAP[lang]}
        </Chip>
      ))}
      {platforms?.map((platform) => (
        <Chip key={platform} variant="flat" color="success" size={size}>
          {SUPPORTED_PLATFORM_MAP[platform]}
        </Chip>
      ))}
    </div>
  )
}
