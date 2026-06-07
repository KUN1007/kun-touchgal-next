import { Chip } from '@heroui/chip'
import { getAllPosts } from '~/lib/mdx/getPosts'
import { KunAboutCard } from '~/components/doc/Card'
import { KunMasonryGrid } from '~/components/kun/MasonryGrid'
import { kunMetadata } from './metadata'
import type { Metadata } from 'next'

export const metadata: Metadata = kunMetadata

export default function Kun() {
  const posts = getAllPosts()

  return (
    <div className="w-full px-3 sm:px-6">
      <section id="doc-list" className="space-y-5 scroll-m-24">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-bold sm:text-2xl">全部文档</h2>
            <p className="text-sm text-default-500">
              如果您在网站遇到任何问题, 都可以来此处查看帮助文档
            </p>
          </div>
          <Chip color="primary" variant="flat" className="w-fit">
            {posts.length} 篇文档
          </Chip>
        </div>

        <KunMasonryGrid columnWidth={300} gap={24}>
          {posts.map((post) => (
            <KunAboutCard key={post.slug} post={post} />
          ))}
        </KunMasonryGrid>
      </section>
    </div>
  )
}
