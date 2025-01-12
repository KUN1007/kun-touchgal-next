import { createStore } from 'zustand/vanilla'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface UserState {
  uid: number
  name: string
  avatar: string
  bio: string
  moemoepoint: number
  role: number
  dailyCheckIn: number
  dailyImageLimit: number
  dailyUploadLimit: number
  enableEmailNotice: boolean
}

export interface UserStore {
  user: UserState
  setUser: (user: UserState) => void
  logout: () => void
}

const initialUserStore: UserState = {
  uid: 0,
  name: '',
  avatar: '',
  bio: '',
  moemoepoint: 0,
  role: 1,
  dailyCheckIn: 1,
  dailyImageLimit: 0,
  dailyUploadLimit: 0,
  enableEmailNotice: false
}

export const createUserStore = (initState: UserState = initialUserStore) => {
  return createStore<UserStore>()(
    persist(
      (set) => ({
        user: initState,
        setUser: (user: UserState) => set({ user }),
        logout: () => set({ user: initState })
      }),
      {
        name: 'kun-patch-user-store',
        storage: createJSONStorage(() => localStorage)
      }
    )
  )
}
