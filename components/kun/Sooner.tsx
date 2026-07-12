'use client'

import toast from 'react-hot-toast'
import type { Toast } from 'react-hot-toast'

export const showKunSooner = (message: string) => {
  void import('./KunSoonerToast').then(({ KunSoonerToast }) => {
    toast.custom((t: Toast) => <KunSoonerToast message={message} t={t} />, {
      position: 'bottom-center',
      duration: 5000
    })
  })
}
