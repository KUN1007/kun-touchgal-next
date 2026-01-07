import { create } from 'zustand'
export interface RewritePatchData {
  id: number
  uniqueId: string
  vndbId: string
  vndbRelationId: string
  dlsiteCode: string
  name: string
  introduction: string
  alias: string[]
  tag: string[]
  contentLimit: string
  released: string
}

interface StoreState {
  data: RewritePatchData
  getData: () => RewritePatchData
  setData: (data: RewritePatchData) => void
  resetData: () => void
}

const initialState: RewritePatchData = {
  id: 0,
  uniqueId: '',
  vndbId: '',
  vndbRelationId: '',
  dlsiteCode: '',
  name: '',
  introduction: '',
  alias: [],
  tag: [],
  contentLimit: 'sfw',
  released: ''
}

export const useRewritePatchStore = create<StoreState>()((set, get) => ({
  data: initialState,
  getData: () => get().data,
  setData: (data: RewritePatchData) => set({ data }),
  resetData: () => set({ data: initialState })
}))
