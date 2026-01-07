import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CreatePatchData {
  name: string
  introduction: string
  vndbId: string
  vndbRelationId: string
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

const initialState: CreatePatchData = {
  name: '',
  introduction: '',
  vndbId: '',
  vndbRelationId: '',
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
      name: 'kun-patch-edit-store',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
