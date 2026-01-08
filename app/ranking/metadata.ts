import { kunMoyuMoe } from '~/config/moyu-moe'
import type { Metadata } from 'next'

export const kunMetadata: Metadata = {
  title: `Galgame 排行榜 - ${kunMoyuMoe.titleShort}`,
  description: `${kunMoyuMoe.titleShort} 游戏排行, 综合评分与下载数等数据, 为所有玩家提供参考`,
  openGraph: {
    title: `Galgame 排行榜 - ${kunMoyuMoe.titleShort}`,
    description: `${kunMoyuMoe.titleShort} 游戏排行, 综合评分与下载数等数据, 为所有玩家提供参考`,
    url: `${kunMoyuMoe.domain.main}/register`,
    siteName: kunMoyuMoe.title,
    images: [
      {
        url: kunMoyuMoe.og.image,
        width: 1920,
        height: 1080,
        alt: `${kunMoyuMoe.titleShort} 游戏排行`
      }
    ],
    locale: 'zh_CN',
    type: 'website'
  },
  alternates: {
    canonical: `${kunMoyuMoe.domain.main}/ranking`,
    languages: {
      'zh-Hans': `${kunMoyuMoe.domain.main}/ranking`
    }
  }
}
