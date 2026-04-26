import { create } from 'zustand'
import type { KunBreadcrumbItem } from '~/constants/routes/constants'

type BreadcrumbStore = {
  titles: Record<string, string>
  setTitle: (key: string, title: string) => void
  clearTitle: (key: string) => void
}

export const initialBreadcrumbItems: KunBreadcrumbItem[] = [
  {
    key: '/',
    label: '主页',
    href: '/'
  }
]

export const useBreadcrumbStore = create<BreadcrumbStore>()((set) => ({
  titles: {},
  setTitle: (key, title) =>
    set((state) => ({
      titles: {
        ...state.titles,
        [key]: title
      }
    })),
  clearTitle: (key) =>
    set((state) => {
      const titles = { ...state.titles }
      delete titles[key]
      return { titles }
    })
}))
