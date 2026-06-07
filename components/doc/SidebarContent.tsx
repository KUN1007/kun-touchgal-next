'use client'

import { KunTreeNode } from '~/lib/mdx/types'
import { TreeItem } from './SideTreeItem'

interface Props {
  tree: KunTreeNode
}

export const SidebarContent = ({ tree }: Props) => {
  return (
    <div className="space-y-1">
      {tree.type === 'directory' &&
        tree.children?.map((child, index) => (
          <TreeItem key={index} node={child} level={0} />
        ))}
    </div>
  )
}
