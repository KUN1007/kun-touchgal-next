'use client'

import { Chip } from '@heroui/chip'
import { Tooltip } from '@heroui/tooltip'
import { Copy } from 'lucide-react'
import { kunCopy } from '~/utils/kunCopy'
import { KunPatchAttribute } from './KunPatchAttribute'
import type { KunPatchResourceResponse } from '~/types/api/kun/moyu-moe'

interface Props {
  resource: KunPatchResourceResponse
}

export const KunResourceInfo = ({ resource }: Props) => {
  return (
    <div className="space-y-2">
      <KunPatchAttribute
        types={resource.type}
        languages={resource.language}
        platforms={resource.platform}
        modelName={resource.model_name}
        size="sm"
      />

      <div className="flex flex-wrap gap-2">
        {resource.code && (
          <Tooltip content="点击复制提取码">
            <Chip
              as="button"
              size="sm"
              color="primary"
              variant="flat"
              className="cursor-pointer"
              startContent={<Copy className="size-3" />}
              onClick={() => kunCopy(resource.code)}
            >
              提取码 <span className="font-mono">{resource.code}</span>
            </Chip>
          </Tooltip>
        )}

        {resource.password && (
          <Tooltip content="点击复制解压码">
            <Chip
              as="button"
              size="sm"
              color="primary"
              variant="flat"
              className="cursor-pointer"
              startContent={<Copy className="size-3" />}
              onClick={() => kunCopy(resource.password)}
            >
              解压码 <span className="font-mono">{resource.password}</span>
            </Chip>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
