import { ReactNode } from 'react'
import { KunSidebar } from '~/components/doc/Sidebar'
import { getDirectoryTree } from '~/lib/mdx/directoryTree'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const tree = getDirectoryTree()

  return (
    <div className="container mx-auto my-4 flex max-w-7xl items-start gap-6 px-0 sm:px-2">
      <KunSidebar tree={tree} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
