'use client'

import { useState } from 'react'
import { Chip } from '@nextui-org/chip'
import { Tooltip } from '@nextui-org/tooltip'
import { Link } from '@nextui-org/link'
import { PatchTagSelector } from './PatchTagSelector'
import { useUserStore } from '~/store/providers/user'
import type { Tag } from '~/types/api/tag'

interface Props {
  patchId: number
  initialTags: Tag[]
}

export const PatchTag = ({ patchId, initialTags }: Props) => {
  const [selectedTags, setSelectedTags] = useState<Tag[]>(initialTags ?? [])
  const user = useUserStore((state) => state.user)

  return (
    <div className="mt-4 space-y-4">
      <h2 className="text-xl font-medium">游戏标签</h2>

      <div className="space-x-2">
        {selectedTags.map((tag) => (
          <Tooltip key={tag.id} content={`${tag.count} 个补丁使用此标签`}>
            <Link href={`/tag/${tag.id}`}>
              <Chip color="secondary" variant="flat">
                {tag.name}
                {` +${tag.count}`}
              </Chip>
            </Link>
          </Tooltip>
        ))}

        {!initialTags.length && <Chip>{'这个补丁暂时没有标签'}</Chip>}
      </div>

      {user.role > 2 && (
        <PatchTagSelector
          patchId={patchId}
          initialTags={selectedTags}
          onTagChange={setSelectedTags}
        />
      )}
    </div>
  )
}
