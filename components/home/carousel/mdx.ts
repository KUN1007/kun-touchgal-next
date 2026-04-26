import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { resolveRuntimeDirectory } from '~/lib/runtimePaths'

export interface HomeCarouselMetadata {
  title: string
  banner: string
  description: string
  date: string
  authorName: string
  authorAvatar: string
  pin: boolean
  directory: string
  link: string
}

const POSTS_PATH = resolveRuntimeDirectory('posts')

let cachedPosts: readonly HomeCarouselMetadata[] | null = null

export const getKunPosts = (): readonly HomeCarouselMetadata[] => {
  if (cachedPosts) {
    return cachedPosts
  }

  if (!fs.existsSync(POSTS_PATH)) {
    return []
  }

  const posts: HomeCarouselMetadata[] = []

  const traverseDirectory = (currentPath: string) => {
    const files = fs.readdirSync(currentPath)

    files.forEach((file) => {
      const filePath = path.join(currentPath, file)
      const stat = fs.statSync(filePath)

      if (stat.isDirectory()) {
        traverseDirectory(filePath)
      } else if (file.endsWith('.mdx')) {
        const fileContents = fs.readFileSync(filePath, 'utf8')
        const { data } = matter(fileContents)

        if (!data.pin) {
          return
        }

        const parentDirectory = path.basename(path.dirname(filePath))
        const fileName = path.basename(file, '.mdx')

        posts.push({
          title: data.title,
          banner: data.banner,
          description: data.description,
          date: new Date(data.date).toISOString(),
          authorName: data.authorName,
          authorAvatar: data.authorAvatar,
          pin: data.pin,
          directory: parentDirectory,
          link: `/doc/${parentDirectory}/${fileName}`
        })
      }
    })
  }

  traverseDirectory(POSTS_PATH)

  cachedPosts = posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  return cachedPosts
}
