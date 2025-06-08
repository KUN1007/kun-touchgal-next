'use client'

import { useState, useEffect } from 'react'
import { Input, Button } from '@nextui-org/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { KeyboardEvent } from 'react'

interface Props {
  total: number
  page: number
  onPageChange: (page: number) => void
  isLoading?: boolean
}

export const KunPagination = ({
  total,
  onPageChange,
  page,
  isLoading = false
}: Props) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(String(page))

  useEffect(() => {
    onPageChange(Number(searchParams.get('page')) || 1)
  }, [searchParams.toString()])

  const createQueryString = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(name, value)
    return params.toString()
  }

  const updateURL = (newPage: number) => {
    router.push(`?${createQueryString('page', String(newPage))}`, {
      scroll: false
    })
    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: 'instant'
      })
    })
  }

  useEffect(() => {
    setInputValue(String(page))
  }, [page])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= total) {
      setInputValue(String(newPage))
      onPageChange(newPage)
      updateURL(newPage)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const newPage = parseInt(inputValue)
      if (!isNaN(newPage) && newPage >= 1 && newPage <= total) {
        handlePageChange(newPage)
        setIsEditing(false)
      }
    } else if (e.key === 'Escape') {
      setInputValue(String(page))
      setIsEditing(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-2 p-2 rounded-2xl">
      <Button
        isIconOnly
        variant="light"
        color="primary"
        onPress={() => handlePageChange(page - 1)}
        isDisabled={page <= 1 || isLoading}
        isLoading={isLoading}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      <div className="flex items-center min-w-[90px] justify-center px-2">
        {isEditing ? (
          <>
            <Input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                setInputValue(String(page))
                setIsEditing(false)
              }}
              className="w-20"
              min={1}
              max={total}
              autoFocus
            />{' '}
            / {total}
          </>
        ) : (
          <Button onPress={() => setIsEditing(true)} variant="bordered">
            {page} / {total}
          </Button>
        )}
      </div>

      <Button
        isIconOnly
        variant="light"
        color="primary"
        onPress={() => handlePageChange(page + 1)}
        isDisabled={page >= total || isLoading}
        isLoading={isLoading}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  )
}
