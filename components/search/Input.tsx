'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Chip, Tooltip } from '@heroui/react'
import { cn } from '~/utils/cn'
import type { SearchSuggestionType } from '~/types/api/search'
import type {
  ChangeEvent,
  Dispatch,
  KeyboardEvent,
  RefObject,
  SetStateAction
} from 'react'
import { X } from 'lucide-react'

interface Props {
  inputRef: RefObject<HTMLInputElement | null>
  query: string
  setQuery: Dispatch<SetStateAction<string>>
  setShowSuggestions: Dispatch<SetStateAction<boolean>>
  selectedSuggestions: SearchSuggestionType[]
  setSelectedSuggestions: Dispatch<SetStateAction<SearchSuggestionType[]>>
  setShowHistory: Dispatch<SetStateAction<boolean>>
}

const KEYWORD_CHIP_CLASS_NAMES = {
  content: 'cursor-pointer opacity-70 transition-opacity hover:opacity-100'
}

export const SearchInput = ({
  inputRef,
  query,
  setQuery,
  setShowSuggestions,
  selectedSuggestions,
  setSelectedSuggestions,
  setShowHistory
}: Props) => {
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  const syncDropdownVisibility = (
    currentQuery: string,
    currentSuggestions: SearchSuggestionType[]
  ) => {
    const hasQuery = currentQuery.trim().length > 0
    const hasSelectedSuggestions = currentSuggestions.length > 0

    setShowSuggestions(hasQuery)
    setShowHistory(!hasQuery && !hasSelectedSuggestions)
  }

  const clearBlurTimeout = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => clearBlurTimeout, [])

  useEffect(() => {
    if (!isFocused) {
      return
    }

    syncDropdownVisibility(query, selectedSuggestions)
  }, [
    isFocused,
    query,
    selectedSuggestions,
    setShowHistory,
    setShowSuggestions
  ])

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
  }

  const handleInputFocus = () => {
    clearBlurTimeout()
    setIsFocused(true)
  }

  const handleInputBlur = () => {
    setIsFocused(false)
    clearBlurTimeout()
    blurTimeoutRef.current = setTimeout(() => {
      setShowHistory(false)
      setShowSuggestions(false)
      blurTimeoutRef.current = null
    }, 100)
  }

  const handleRemoveChip = (suggestionToRemove: SearchSuggestionType) => {
    clearBlurTimeout()
    setSelectedSuggestions((prevSuggestions) =>
      prevSuggestions.filter(
        (suggestion) =>
          !(
            suggestion.type === suggestionToRemove.type &&
            suggestion.name === suggestionToRemove.name
          )
      )
    )
    inputRef.current?.focus()
  }
  const handleEditKeywordChip = (suggestionToEdit: SearchSuggestionType) => {
    if (suggestionToEdit.type !== 'keyword') {
      return
    }

    clearBlurTimeout()
    setSelectedSuggestions((prevSuggestions) =>
      prevSuggestions.filter(
        (suggestion) =>
          !(
            suggestion.type === suggestionToEdit.type &&
            suggestion.name === suggestionToEdit.name
          )
      )
    )
    setQuery((currentQuery) => {
      const trimmedQuery = currentQuery.trim()
      return trimmedQuery
        ? `${trimmedQuery} ${suggestionToEdit.name}`
        : suggestionToEdit.name
    })
    setCanDeleteTag(false)
    setIsFocused(true)
    setShowHistory(false)
    setShowSuggestions(true)
    inputRef.current?.focus()
  }

  const getSuggestionLabel = (suggestion: SearchSuggestionType) => {
    const name =
      suggestion.type === 'tag'
        ? `#${suggestion.name}`
        : suggestion.type === 'company'
          ? `会社:${suggestion.name}`
          : suggestion.name

    return `${suggestion.mode === 'exclude' ? '排除 ' : ''}${name}`
  }

  const handleExecuteSearch = () => {
    if (!query.trim()) {
      return
    }
    const queryArraySplitByBlank = query
      .trim()
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
    if (!queryArraySplitByBlank.length) {
      return
    }

    const suggestions: SearchSuggestionType[] = queryArraySplitByBlank.map(
      (q) => ({
        type: 'keyword',
        mode: 'include',
        name: q
      })
    )
    setSelectedSuggestions((prev) => {
      const keysToRemove = new Set(
        suggestions.map((s) => `${s.type}:${s.name}`)
      )
      const filtered = prev.filter(
        (item) => !keysToRemove.has(`${item.type}:${item.name}`)
      )
      return [...filtered, ...suggestions]
    })
    setQuery('')
  }

  const [canDeleteTag, setCanDeleteTag] = useState(false)
  const handleKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
    if (selectedSuggestions.length || !query.length) {
      setCanDeleteTag(false)
    }

    if (
      event.key === 'Backspace' &&
      selectedSuggestions.length &&
      !query.trim()
    ) {
      if (canDeleteTag) {
        setSelectedSuggestions((prev) => prev.slice(0, -1))
      } else {
        setCanDeleteTag(true)
      }
    } else if (event.key === 'Enter') {
      handleExecuteSearch()
    }
  }

  const isShowClearButton = !!(query.length || selectedSuggestions.length)
  const placeholder =
    selectedSuggestions.length > 0
      ? '继续添加关键词'
      : '输入内容, 点击按钮或回车创建关键词'

  const handleClearInput = () => {
    clearBlurTimeout()
    setQuery('')
    setSelectedSuggestions([])
    setIsFocused(true)
    syncDropdownVisibility('', [])
    inputRef.current?.focus()
  }

  return (
    <div
      className={cn(
        'flex gap-2 p-3 bg-default-100 rounded-large transition-all duration-200',
        isFocused
          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
          : ''
      )}
    >
      <div className="flex flex-wrap items-center w-full gap-2">
        {selectedSuggestions.map((suggestion, index) => (
          <Chip
            key={index}
            variant="flat"
            color={
              suggestion.mode === 'exclude'
                ? 'danger'
                : suggestion.type === 'keyword'
                  ? 'primary'
                  : suggestion.type === 'company'
                    ? 'warning'
                    : 'secondary'
            }
            classNames={
              suggestion.type === 'keyword'
                ? KEYWORD_CHIP_CLASS_NAMES
                : undefined
            }
            onClick={(event) => {
              const target = event.target
              if (
                suggestion.type !== 'keyword' ||
                (target instanceof Element &&
                  target.closest('[aria-label="close chip"]'))
              ) {
                return
              }

              handleEditKeywordChip(suggestion)
            }}
            onClose={() => handleRemoveChip(suggestion)}
          >
            {getSuggestionLabel(suggestion)}
          </Chip>
        ))}

        <input
          ref={inputRef}
          className="placeholder-default-500 text-default-700 min-w-[120px] flex-grow bg-transparent outline-none"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyUp={(e) => handleKeyUp(e)}
          placeholder={placeholder}
        />

        {isShowClearButton && (
          <Tooltip content="清除搜索内容">
            <Button
              isIconOnly
              key="delete_button"
              variant="light"
              onPress={handleClearInput}
            >
              <X />
            </Button>
          </Tooltip>
        )}

        <Button color="primary" onPress={handleExecuteSearch}>
          搜索
        </Button>
      </div>
    </div>
  )
}
