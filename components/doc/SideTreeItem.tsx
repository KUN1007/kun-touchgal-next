'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, FileText, FolderOpen } from 'lucide-react'
import { cn } from '~/utils/cn'
import type { KunTreeNode } from '~/lib/mdx/types'

interface TreeItemProps {
  node: KunTreeNode
  level: number
}

const getNodeHref = (node: KunTreeNode) => `/doc/${node.path}`

const hasActiveNode = (node: KunTreeNode, pathname: string): boolean => {
  if (node.type === 'file') {
    return pathname === getNodeHref(node)
  }

  return node.children?.some((child) => hasActiveNode(child, pathname)) ?? false
}

export const TreeItem = ({ node, level }: TreeItemProps) => {
  const pathname = usePathname()
  const isFile = node.type === 'file'
  const isActive = isFile && pathname === getNodeHref(node)
  const isInActiveTree = !isFile && hasActiveNode(node, pathname)
  const [isOpen, setIsOpen] = useState(isInActiveTree)

  useEffect(() => {
    if (isInActiveTree) {
      setIsOpen(true)
    }
  }, [isInActiveTree])

  const itemClassName = cn(
    'flex min-h-10 w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 motion-reduce:transition-none',
    level === 0 ? 'mt-0' : 'mt-1',
    isActive
      ? 'bg-primary-500/10 font-medium text-primary-600 ring-1 ring-inset ring-primary-500/20 dark:text-primary-400'
      : isInActiveTree
        ? 'bg-default-100/70 font-medium text-foreground'
        : 'text-default-600 hover:bg-default-100 hover:text-foreground'
  )
  const itemStyle = { paddingLeft: `${level * 12 + 12}px` }

  const content = (
    <>
      {node.type === 'directory' ? (
        <>
          <ChevronRight
            className={cn(
              'size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none',
              isOpen && 'rotate-90'
            )}
          />
          <FolderOpen className="size-4 shrink-0 text-warning" />
        </>
      ) : (
        <FileText className="ml-5 size-4 shrink-0 text-primary" />
      )}
      <span className="min-w-0 text-wrap">{node.label}</span>
    </>
  )

  return (
    <nav className="select-none">
      {isFile ? (
        <Link
          href={getNodeHref(node)}
          className={itemClassName}
          style={itemStyle}
          aria-current={isActive ? 'page' : undefined}
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          className={itemClassName}
          style={itemStyle}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          {content}
        </button>
      )}

      {node.type === 'directory' && (
        <div
          className={cn(
            'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none',
            isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="min-h-0 overflow-hidden">
            {node.children?.map((child, index) => (
              <TreeItem key={index} node={child} level={level + 1} />
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
