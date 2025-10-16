import { kunMoyuMoe } from '~/config/moyu-moe'
import { SUPPORTED_TYPE_MAP } from '~/constants/resource'
import type { Metadata } from 'next'

export const kunMetadata: Metadata = {
  title: `Galgame 会社分类`,
  description: `所有的 Galgame 会社分类, ${Object.values(SUPPORTED_TYPE_MAP).toString()} 下载`,
  openGraph: {
    title: `Galgame 会社分类`,
    description: `所有的 Galgame 会社分类, ${Object.values(SUPPORTED_TYPE_MAP).toString()} 下载`,
    type: 'website',
    images: kunMoyuMoe.images
  },
  twitter: {
    card: 'summary_large_image',
    title: `Galgame 会社分类`,
    description: `所有的 Galgame 会社分类, ${Object.values(SUPPORTED_TYPE_MAP).toString()} 下载`
  },
  alternates: {
    canonical: `${kunMoyuMoe.domain.main}/company`
  }
}
