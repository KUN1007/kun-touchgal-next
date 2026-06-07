import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { docDirectoryLabelMap } from '~/constants/doc'
import type { KunTreeNode } from './types'
import { resolveRuntimeDirectory } from '~/lib/runtimePaths'

const POSTS_PATH = resolveRuntimeDirectory('posts')

export const getDirectoryTree = (): KunTreeNode => {
  const buildTree = (
    currentPath: string,
    baseName: string
  ): KunTreeNode | null => {
    const stats = fs.statSync(currentPath)

    if (stats.isFile() && currentPath.endsWith('.mdx')) {
      const fileContents = fs.readFileSync(currentPath, 'utf8')
      const { data } = matter(fileContents)

      return {
        name: baseName.replace(/\.mdx$/, ''),
        label: data.title,
        date: data.date ? new Date(data.date).toISOString() : '',
        path: path
          .relative(POSTS_PATH, currentPath)
          .replace(/\.mdx$/, '')
          .replace(/\\/g, '/'),
        type: 'file'
      }
    }

    if (stats.isDirectory()) {
      const children = fs
        .readdirSync(currentPath)
        .map((child) => buildTree(path.join(currentPath, child), child))
        .filter((child): child is KunTreeNode => child !== null)
        .sort((a, b) => (a.date > b.date ? -1 : 1))
      return {
        name: baseName,
        label: docDirectoryLabelMap[baseName],
        date: children[0]?.date ?? '',
        path: path.relative(POSTS_PATH, currentPath).replace(/\\/g, '/'),
        children,
        type: 'directory'
      }
    }

    return null
  }

  return buildTree(POSTS_PATH, 'doc') as KunTreeNode
}
