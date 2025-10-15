export interface PatchComment {
  id: number
  uniqueId: string
  user: KunUser
  content: string
  patchName: string
  patchId: number
  like: number
  created: Date | string
}
