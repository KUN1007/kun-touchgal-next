'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Star } from 'lucide-react'

export type RatingColor =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'

export interface RatingProps {
  value?: number
  defaultValue?: number
  stars?: number
  valueMax?: 5 | 10
  step?: 0.5 | 1
  readOnly?: boolean
  disabled?: boolean
  allowClear?: boolean
  onChange?: (value: number) => void
  onHoverChange?: (value: number | null) => void
  size?: 'sm' | 'md' | 'lg'
  color?: RatingColor
  className?: string
  itemClassName?: string
  'aria-label'?: string
  id?: string
}

const sizeMap = { sm: 18, md: 22, lg: 28 } as const

const colorClass = (color: RatingColor) => {
  switch (color) {
    case 'primary':
      return 'text-primary'
    case 'secondary':
      return 'text-secondary'
    case 'success':
      return 'text-success'
    case 'warning':
      return 'text-warning'
    case 'danger':
      return 'text-danger'
    default:
      return 'text-foreground'
  }
}

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v))

export const KunRating = (props: RatingProps) => {
  const {
    value,
    defaultValue = 0,
    stars = 5,
    valueMax = 5,
    step = 0.5,
    readOnly = false,
    disabled = false,
    allowClear = true,
    onChange,
    onHoverChange,
    size = 'md',
    color = 'warning',
    className,
    itemClassName,
    id,
    'aria-label': ariaLabel = 'Rating'
  } = props

  const isControlled = typeof value === 'number'
  const [internal, setInternal] = useState<number>(defaultValue) // external scale
  const [hoverStar, setHoverStar] = useState<number | null>(null) // star scale

  useEffect(() => {
    if (isControlled) setInternal(value as number)
  }, [isControlled, value])

  const normalizeToStars = useCallback(
    (v: number) => (stars > 0 ? (v / valueMax) * stars : 0),
    [stars, valueMax]
  )
  const denormalizeFromStars = useCallback(
    (s: number) => (stars > 0 ? (s / stars) * valueMax : 0),
    [stars, valueMax]
  )

  const currentStar = hoverStar ?? normalizeToStars(internal)

  const setValueFromStars = useCallback(
    (starVal: number) => {
      const roundedStar =
        step === 1 ? Math.round(starVal) : Math.round(starVal * 2) / 2
      const clampedStar = clamp(roundedStar, 0, stars)
      const nextExternal = denormalizeFromStars(clampedStar)
      if (!isControlled) setInternal(nextExternal)
      onChange?.(nextExternal)
    },
    [denormalizeFromStars, isControlled, onChange, stars, step]
  )

  const handleMouseMove =
    (index: number) => (e: React.MouseEvent<HTMLDivElement>) => {
      if (readOnly || disabled) return
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
      const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1)
      let starVal = index + 1
      if (step === 0.5) starVal = index + (ratio <= 0.5 ? 0.5 : 1)
      setHoverStar(starVal)
      onHoverChange?.(denormalizeFromStars(starVal))
    }

  const handleMouseLeave = () => {
    if (readOnly || disabled) return
    setHoverStar(null)
    onHoverChange?.(null)
  }

  const handleClick = (index: number) => () => {
    if (readOnly || disabled) return
    const starVal = hoverStar ?? index + 1
    const currentExternal = denormalizeFromStars(currentStar || 0)
    const nextExternal = denormalizeFromStars(starVal)
    if (
      allowClear &&
      Math.abs(
        nextExternal - (isControlled ? (value as number) : currentExternal)
      ) < 1e-8
    ) {
      setValueFromStars(0)
    } else {
      setValueFromStars(starVal)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || disabled) return
    const delta = step === 1 ? 1 : 0.5
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      setValueFromStars((currentStar || 0) + delta)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      setValueFromStars((currentStar || 0) - delta)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setValueFromStars(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setValueFromStars(stars)
    } else if (allowClear && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault()
      setValueFromStars(0)
    }
  }

  const stateForIndex = (i: number) => {
    const c = currentStar || 0
    if (c >= i + 1) return 'full' as const
    if (step === 0.5 && c >= i + 0.5) return 'half' as const
    return 'empty' as const
  }

  const px = sizeMap[size]
  const colorCls = colorClass(color)
  const isInteractive = !readOnly && !disabled

  return (
    <div
      id={id}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={valueMax}
      aria-valuenow={
        Math.round(denormalizeFromStars(currentStar || 0) * 10) / 10
      }
      tabIndex={isInteractive ? 0 : -1}
      onKeyDown={handleKeyDown}
      onMouseLeave={handleMouseLeave}
      className={clsx(
        'inline-flex items-center gap-1 outline-none',
        isInteractive && 'cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {Array.from({ length: stars }).map((_, i) => {
        const state = stateForIndex(i)
        return (
          <div
            key={i}
            className={clsx('relative inline-flex', itemClassName)}
            style={{ width: px, height: px }}
            onMouseMove={handleMouseMove(i)}
            onClick={handleClick(i)}
          >
            {state === 'full' ? (
              <Star
                className={clsx('w-full h-full', colorCls)}
                strokeWidth={1.75}
                fill="currentColor"
              />
            ) : state === 'half' ? (
              <div className="w-full h-full relative">
                <Star
                  className={clsx(
                    'w-full h-full absolute inset-0',
                    colorCls,
                    'pointer-events-none'
                  )}
                  strokeWidth={0}
                  style={{
                    clipPath: 'inset(0 50% 0 0)',
                    stroke: 'transparent'
                  }}
                  fill="currentColor"
                />
                <Star
                  className={clsx(
                    'w-full h-full absolute inset-0',
                    'text-warning',
                    'pointer-events-none'
                  )}
                  strokeWidth={1.75}
                  fill="none"
                />
              </div>
            ) : (
              <Star
                className={clsx('w-full h-full', 'text-default-300')}
                strokeWidth={1.75}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
