'use client'

import { useCallback } from 'react'
import type { Options } from 'canvas-confetti'

export const useConfetti = () => {
  return useCallback(() => {
    void import('canvas-confetti')
      .then(({ default: confetti }) => {
        const count = 200
        const defaults = {
          origin: { y: 0.7 },
          zIndex: 9999
        }

        function fire(particleRatio: number, opts: Options) {
          confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio)
          })
        }

        fire(0.25, {
          spread: 26,
          startVelocity: 55,
          scalar: 0.8
        })

        fire(0.2, {
          spread: 60,
          scalar: 1.2
        })

        fire(0.35, {
          spread: 100,
          decay: 0.91,
          scalar: 0.8
        })

        fire(0.1, {
          spread: 120,
          startVelocity: 25,
          decay: 0.92,
          scalar: 1.2
        })

        fire(0.1, {
          spread: 120,
          startVelocity: 45,
          scalar: 1.2
        })
      })
      .catch(() => {})
  }, [])
}
