import { kunMoyuMoe } from '~/config/moyu-moe'
import type { Metadata } from 'next'
import type { KunSiteAuthor } from '~/config/config'
import type { Patch, PatchComment } from '~/types/api/patch'

export const generateKunMetadataTemplate = (
  patch: Patch,
  comments: PatchComment[]
): Metadata => {
  const authors: KunSiteAuthor[] = comments.map((com) => ({
    name: com.user.name,
    url: `${kunMoyuMoe.domain.main}/user/${com.user.id}/resource`
  }))
  const uniqueAuthors = authors.filter(
    (author, index, self) =>
      index === self.findIndex((a) => a.name === author.name)
  )
  const uniqueAuthorsName = uniqueAuthors.map((u) => u.name)

  return {
    title: patch.alias.length
      ? `${patch.name} | ${patch.alias[0]} 的 评论`
      : `${patch.name} 的 评论`,
    keywords: [...patch.alias, '评论'],
    authors: uniqueAuthors,
    creator: patch.user.name,
    publisher: patch.user.name,
    description: comments.length
      ? `${uniqueAuthorsName} 在 ${patch.name} 下发布了 ${comments[0].content} 等评论, 查看更多`
      : `点击查看 ${patch.name} 下的评论`,
    openGraph: {
      title: patch.alias.length
        ? `${patch.name} | ${patch.alias[0]} 的 评论`
        : `${patch.name} 的 评论`,
      description: comments.length
        ? `${uniqueAuthorsName} 在 ${patch.name} 下发布了 ${comments[0].content} 等评论, 查看更多`
        : `点击查看 ${patch.name} 下的评论`,
      type: 'article',
      publishedTime: patch.created,
      modifiedTime: patch.updated,
      images: [
        {
          url: patch.banner,
          width: 1920,
          height: 1080,
          alt: patch.name
        }
      ]
    },
    twitter: {
      card: 'summary',
      title: patch.alias.length
        ? `${patch.name} | ${patch.alias[0]} 的 评论`
        : `${patch.name} 的 评论`,
      description: comments.length
        ? `${uniqueAuthorsName} 在 ${patch.name} 下发布了 ${comments[0].content} 等评论, 查看更多`
        : `点击查看 ${patch.name} 下的评论`,
      images: [patch.banner]
    },
    alternates: {
      canonical: `${kunMoyuMoe.domain.main}/patch/${patch.id}/comment`
    }
  }
}
