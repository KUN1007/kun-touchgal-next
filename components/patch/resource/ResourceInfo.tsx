'use client'

import { KunPatchAttribute } from '~/components/kun/PatchAttribute'
import type { PatchResource } from '~/types/api/patch'

interface Props {
  resource: PatchResource
}

export const ResourceInfo = ({ resource }: Props) => {
  return (
    <div className="space-y-2">
      <KunPatchAttribute
        types={resource.type}
        languages={resource.language}
        platforms={resource.platform}
        size="sm"
      />
    </div>
  )
}
