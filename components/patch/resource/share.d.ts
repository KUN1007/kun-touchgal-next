import type {
  Control,
  FieldErrors,
  UseFormSetValue,
  UseFormWatch
} from 'react-hook-form'
import type { PatchResourceLink } from '~/types/api/patch'

interface Fields {
  type: string[]
  name: string
  section: string
  patchId: number
  note: string
  language: string[]
  platform: string[]
  emulatorType: string
  modelName: string
  links: Array<{
    id?: number
    storage: PatchResourceLink['storage']
    hash: PatchResourceLink['hash']
    content: PatchResourceLink['content']
    size: PatchResourceLink['size']
    code: PatchResourceLink['code']
    password: PatchResourceLink['password']
  }>
}

export interface FileStatus {
  file: File
  progress: number
  error?: string
  hash?: string
  filetype?: string
}

export type ErrorType = FieldErrors<Fields>
export type ControlType = Control<Fields, any>
export type SetValueType = UseFormSetValue<Fields>
export type WatchType = UseFormWatch<Fields>
