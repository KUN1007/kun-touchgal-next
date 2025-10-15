export interface PatchResource {
  id: number
  name: string
  section: string
  uniqueId: string
  storage: string
  size: string
  type: string[]
  language: string[]
  platform: string[]
  note: string
  likeCount: number
  download: number
  patchId: number
  patchName: string
  created: string
  user: KunUser & {
    patchCount: number
    role: number
  }
}
