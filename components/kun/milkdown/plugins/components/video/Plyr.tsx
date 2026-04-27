'use client'

import React, { useEffect, useRef } from 'react'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

interface VideoPlayerProps {
  src: string
  className?: string
}

export const KunPlyr = ({ src, className = '' }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<Plyr | null>(null)

  useEffect(() => {
    if (!videoRef.current) {
      return
    }

    let cancelled = false
    const id = window.setTimeout(() => {
      if (cancelled || !videoRef.current || playerRef.current) {
        return
      }
      playerRef.current = new Plyr(videoRef.current, {
        controls: [
          'play-large',
          'play',
          'progress',
          'current-time',
          'mute',
          'volume',
          'captions',
          'settings',
          'pip',
          'airplay',
          'fullscreen'
        ],
        settings: ['captions', 'quality', 'speed']
      })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(id)
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [])

  return (
    <video ref={videoRef} className={`plyr-react ${className}`} playsInline>
      <source src={src} type="video/mp4" />
    </video>
  )
}
