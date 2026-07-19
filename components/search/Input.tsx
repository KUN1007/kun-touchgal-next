'use client'

import { useEffect, useState } from 'react'
import { Button, Chip, Tooltip } from '@heroui/react'
import { cn } from '~/utils/cn'
import {
  SEARCH_SUGGESTION_HINT_ID,
  SEARCH_SUGGESTION_LISTBOX_ID
} from './Suggestion'
import type { SearchSuggestionNav } from './Suggestion'
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
  showSuggestions: boolean
  setShowSuggestions: Dispatch<SetStateAction<boolean>>
  selectedSuggestions: SearchSuggestionType[]
  setSelectedSuggestions: Dispatch<SetStateAction<SearchSuggestionType[]>>
  setShowHistory: Dispatch<SetStateAction<boolean>>
  activeDescendantId?: string
  suggestionNavRef: RefObject<SearchSuggestionNav | null>
}

const KEYWORD_CHIP_CLASS_NAMES = {
  content: 'cursor-pointer opacity-70 transition-opacity hover:opacity-100'
}

export const SearchInput = ({
  inputRef,
  query,
  setQuery,
  showSuggestions,
  setShowSuggestions,
  selectedSuggestions,
  setSelectedSuggestions,
  setShowHistory,
  activeDescendantId,
  suggestionNavRef
}: Props) => {
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

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
    // 同步调用使 query 清空与下拉关闭落在同一次提交,防止退格删空时闪烁;
    // focus 与程序化 setQuery 路径由上方 effect 兜底,两处缺一不可
    syncDropdownVisibility(event.target.value, selectedSuggestions)
  }

  const handleInputFocus = () => {
    setIsFocused(true)
  }

  const handleInputBlur = () => {
    setIsFocused(false)
  }

  const handleRemoveChip = (suggestionToRemove: SearchSuggestionType) => {
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

  const handleExecuteSearch = (
    mode: SearchSuggestionType['mode'] = 'include'
  ) => {
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
        mode,
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
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (suggestionNavRef.current) {
        event.preventDefault()
        suggestionNavRef.current.move(event.key === 'ArrowDown' ? 1 : -1)
      }
      return
    }

    if (event.key === 'Escape') {
      setShowSuggestions(false)
      setShowHistory(false)
      return
    }

    if (event.key === 'Enter') {
      const mode = event.shiftKey ? 'exclude' : 'include'
      if (suggestionNavRef.current?.activate(mode)) {
        event.preventDefault()
        return
      }
      handleExecuteSearch(mode)
      return
    }

    if (
      event.key === 'Backspace' &&
      selectedSuggestions.length &&
      !query.trim()
    ) {
      if (event.repeat) {
        return
      }
      if (canDeleteTag) {
        setSelectedSuggestions((prev) => prev.slice(0, -1))
        setCanDeleteTag(false)
      } else {
        setCanDeleteTag(true)
      }
      return
    }

    setCanDeleteTag(false)
  }

  const isShowClearButton = !!(query.length || selectedSuggestions.length)
  const placeholder =
    selectedSuggestions.length > 0
      ? '继续添加关键词'
      : '输入内容, 点击按钮或回车创建关键词'

  const handleClearInput = () => {
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
                : suggestion.type === 'company'
                  ? 'warning'
                  : suggestion.type === 'tag'
                    ? 'secondary'
                    : 'default'
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
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls={
            showSuggestions ? SEARCH_SUGGESTION_LISTBOX_ID : undefined
          }
          aria-activedescendant={activeDescendantId}
          aria-autocomplete="list"
          aria-describedby={
            showSuggestions ? SEARCH_SUGGESTION_HINT_ID : undefined
          }
          aria-label="搜索 Galgame"
          className="placeholder-default-500 text-default-700 min-w-[120px] flex-grow bg-transparent outline-none"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
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

        <Button color="primary" onPress={() => handleExecuteSearch()}>
          搜索
        </Button>
      </div>
    </div>
  )
}
