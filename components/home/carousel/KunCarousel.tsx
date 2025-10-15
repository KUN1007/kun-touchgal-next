'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { KunDesktopCard } from './DesktopCard'
import { KunMobileCard } from './MobileCard'
import { RandomGalgameButton } from './RandomGalgameButton'
import { KunHomeNavigationItems } from '../NavigationItems'
import type { HomeCarouselMetadata } from './mdx'

interface KunCarouselProps {
  posts: HomeCarouselMetadata[]
}

export const KunCarousel = ({ posts }: KunCarouselProps) => {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [direction, setDirection] = useState(0)
  const [isPageVisible, setIsPageVisible] = useState(true)

  useEffect(() => {
    const handleVisibility = () => {
      const visible =
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'

      setIsPageVisible(visible)

      if (visible) {
        setCurrentSlide((prev) =>
          posts.length > 0
            ? ((prev % posts.length) + posts.length) % posts.length
            : 0
        )
        setDirection(0)
      }
    }
    handleVisibility()

    document.addEventListener('visibilitychange', handleVisibility)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility)
  }, [posts.length])

  useEffect(() => {
    if (isHovered || !isPageVisible || posts.length === 0) {
      return
    }

    const timer = setInterval(() => {
      setDirection(1)
      setCurrentSlide((prev) =>
        posts.length > 0 ? (prev + 1) % posts.length : 0
      )
    }, 5000)

    return () => clearInterval(timer)
  }, [isHovered, isPageVisible, posts.length])

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.95
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.95
    })
  }

  const swipeConfidenceThreshold = 10000
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity
  }

  const paginate = (newDirection: number) => {
    setDirection(newDirection)
    setCurrentSlide(
      (prev) => (prev + newDirection + posts.length) % posts.length
    )
  }

  return (
    <div
      className="relative h-[300px] overflow-hidden group touch-pan-y flex items-end"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence initial={false} custom={direction} mode="sync">
        <motion.div
          key={currentSlide}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'tween', duration: 0.4, ease: 'easeInOut' },
            opacity: { duration: 0.3 },
            scale: { duration: 0.3 }
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragEnd={(_, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x)

            if (swipe < -swipeConfidenceThreshold) {
              paginate(1)
            } else if (swipe > swipeConfidenceThreshold) {
              paginate(-1)
            }
          }}
          className="absolute w-full h-full cursor-grab active:cursor-grabbing"
        >
          <KunDesktopCard posts={posts} currentSlide={currentSlide} />

          <KunMobileCard posts={posts} currentSlide={currentSlide} />
        </motion.div>
      </AnimatePresence>

      <div className="z-10 w-full py-3 space-y-3 sm:hidden">
        <RandomGalgameButton
          className="shadow-md"
          color="primary"
          variant="flat"
          size="sm"
          fullWidth
        >
          随机一部游戏
        </RandomGalgameButton>

        <div className="grid grid-cols-3 gap-3 sm:hidden sm:gap-6">
          <KunHomeNavigationItems buttonSize="sm" />
        </div>
      </div>

      <button
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 p-1.5 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 touch:opacity-100 z-10"
        onClick={() => paginate(-1)}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <button
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 p-1.5 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 touch:opacity-100 z-10"
        onClick={() => paginate(1)}
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <div className="absolute z-10 flex gap-1 -translate-x-1/2 top-[188px] sm:top-[288px] left-1/2">
        {posts.map((_, index) => (
          <button
            key={index}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              index === currentSlide
                ? 'bg-primary w-4'
                : 'bg-foreground/20 hover:bg-foreground/40'
            }`}
            onClick={() => {
              setDirection(index > currentSlide ? 1 : -1)
              setCurrentSlide(index)
            }}
          />
        ))}
      </div>
    </div>
  )
}
