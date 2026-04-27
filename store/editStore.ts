import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CreatePatchData {
  name: string
  introduction: string
  vndbId: string
  vndbRelationId: string
  bangumiId: string
  steamId: string
  dlsiteCode: string
  dlsiteCircleName: string
  dlsiteCircleLink: string
  vndbTags: string[]
  vndbDevelopers: string[]
  bangumiTags: string[]
  bangumiDevelopers: string[]
  steamTags: string[]
  steamDevelopers: string[]
  steamAliases: string[]
  alias: string[]
  tag: string[]
  released: string
  contentLimit: string
}

export interface CreatePatchRequestData extends CreatePatchData {
  banner: Blob | null
}

interface StoreState {
  data: CreatePatchData
  getData: () => CreatePatchData
  setData: (data: CreatePatchData) => void
  resetData: () => void
}

export const createPatchEditStoreKey = 'kun-patch-edit-store'

const initialState: CreatePatchData = {
  name: '',
  introduction: '',
  vndbId: '',
  vndbRelationId: '',
  bangumiId: '',
  steamId: '',
  dlsiteCode: '',
  dlsiteCircleName: '',
  dlsiteCircleLink: '',
  vndbTags: [],
  vndbDevelopers: [],
  bangumiTags: [],
  bangumiDevelopers: [],
  steamTags: [],
  steamDevelopers: [],
  steamAliases: [],
  alias: [],
  tag: [],
  released: '',
  contentLimit: 'sfw'
}

export const useCreatePatchStore = create<StoreState>()(
  persist(
    (set, get) => ({
      data: initialState,
      getData: () => get().data,
      setData: (data: CreatePatchData) => set({ data }),
      resetData: () => set({ data: initialState })
    }),
    {
      name: createPatchEditStoreKey,
      storage: createJSONStorage(() => window.localStorage)
    }
  )
)
