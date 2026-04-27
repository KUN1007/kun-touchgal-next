import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { SearchSuggestionType } from '~/types/api/search'

export interface CreateSearchData {
  searchHistory: SearchSuggestionType[][]
  searchInIntroduction: boolean
  searchInAlias: boolean
  searchInTag: boolean
}

const initialState: CreateSearchData = {
  searchHistory: [],
  searchInIntroduction: false,
  searchInAlias: true,
  searchInTag: false
}

interface SearchStoreState {
  data: CreateSearchData
  getData: () => CreateSearchData
  setData: (data: CreateSearchData) => void
  resetData: () => void
}

export const useSearchStore = create<SearchStoreState>()(
  persist(
    (set, get) => ({
      data: initialState,
      getData: () => get().data,
      setData: (data: CreateSearchData) => set({ data }),
      resetData: () => set({ data: initialState })
    }),
    {
      name: 'kun-patch-search-store-v3',
      storage: createJSONStorage(() => window.localStorage)
    }
  )
)
