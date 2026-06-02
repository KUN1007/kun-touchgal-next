'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

interface VideoPlayerProps {
  src: string
  className?: string
  onReady?: () => void
  autoPlay?: boolean
}

export const KunPlyr = ({
  src,
  className = '',
  onReady,
  autoPlay = false
}: VideoPlayerProps) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Plyr | null>(null)
  const onReadyRef = useRef(onReady)
  const didNotifyReadyRef = useRef(false)

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  const notifyReady = useCallback(() => {
    if (didNotifyReadyRef.current) {
      return
    }

    didNotifyReadyRef.current = true
    onReadyRef.current?.()
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }

    const video = document.createElement('video')
    const source = document.createElement('source')
    video.className = `plyr-react ${className}`.trim()
    video.playsInline = true
    video.autoplay = autoPlay
    const shouldAutoLoad = autoPlay || Boolean(onReadyRef.current)
    video.preload = shouldAutoLoad ? 'auto' : 'metadata'
    source.src = src
    source.type = 'video/mp4'
    video.append(source)
    host.replaceChildren(video)

    let cancelled = false
    let hasMediaData = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA

    const playWhenRequested = (player: Plyr) => {
      if (!autoPlay) {
        return
      }

      const playResult = player.play()
      if (playResult) {
        void playResult.catch(() => undefined)
      }
    }

    const notifyReadyWhenLoaded = () => {
      const player = playerRef.current
      if (cancelled || !hasMediaData || !player) {
        return
      }

      notifyReady()
      playWhenRequested(player)
    }

    const handleLoadedData = () => {
      hasMediaData = true
      notifyReadyWhenLoaded()
    }

    video.addEventListener('loadeddata', handleLoadedData, { once: true })

    const id = window.setTimeout(() => {
      if (cancelled || playerRef.current) {
        return
      }

      playerRef.current = new Plyr(video, {
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
      notifyReadyWhenLoaded()
    }, 0)

    if (hasMediaData) {
      notifyReadyWhenLoaded()
    } else if (shouldAutoLoad) {
      video.load()
    }

    return () => {
      cancelled = true
      video.removeEventListener('loadeddata', handleLoadedData)
      window.clearTimeout(id)
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
      host.replaceChildren()
    }
  }, [autoPlay, className, notifyReady, src])

  return <div ref={hostRef} className={className} />
}
