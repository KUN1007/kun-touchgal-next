import type { PatchComment } from './comment'
import type { PatchResource } from './resource'

export interface HomeCarousel {
  id: number
  galgameTitle: string
  description: string
  type: string[]
  language: string[]
  platform: string[]
}

export type HomeResource = PatchResource
export type HomeComment = PatchComment
