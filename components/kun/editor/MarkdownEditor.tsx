'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@heroui/button'
import { Tooltip } from '@heroui/tooltip'
import {
  Bold,
  Italic,
  Strikethrough,
  Heading,
  Link,
  Image,
  Quote,
  Code,
  List,
  ListOrdered,
  Minus,
  Eye,
  PenLine
} from 'lucide-react'
import { cn } from '~/utils/cn'
import { markdownToPreviewHtml } from '~/utils/markdownPreview'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
  className?: string
}

interface ToolbarAction {
  icon: typeof Bold
  label: string
  title: string
  prefix: string
  suffix: string
  multiline?: boolean
  placeholder?: string
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  {
    icon: Bold,
    label: 'Bold',
    title: '加粗 (Ctrl+B)',
    prefix: '**',
    suffix: '**'
  },
  {
    icon: Italic,
    label: 'Italic',
    title: '斜体 (Ctrl+I)',
    prefix: '*',
    suffix: '*'
  },
  {
    icon: Strikethrough,
    label: 'Strikethrough',
    title: '删除线',
    prefix: '~~',
    suffix: '~~'
  },
  {
    icon: Heading,
    label: 'Heading',
    title: '标题',
    prefix: '## ',
    suffix: ''
  },
  {
    icon: Link,
    label: 'Link',
    title: '链接 (Ctrl+K)',
    prefix: '[',
    suffix: '](url)',
    placeholder: '链接文字'
  },
  {
    icon: Image,
    label: 'Image',
    title: '图片',
    prefix: '![',
    suffix: '](url)',
    placeholder: '图片描述'
  },
  {
    icon: Quote,
    label: 'Quote',
    title: '引用',
    prefix: '> ',
    suffix: ''
  },
  {
    icon: Code,
    label: 'Code',
    title: '代码块',
    prefix: '```\n',
    suffix: '\n```',
    multiline: true,
    placeholder: '代码'
  },
  {
    icon: List,
    label: 'Unordered List',
    title: '无序列表',
    prefix: '- ',
    suffix: ''
  },
  {
    icon: ListOrdered,
    label: 'Ordered List',
    title: '有序列表',
    prefix: '1. ',
    suffix: ''
  },
  {
    icon: Minus,
    label: 'Horizontal Rule',
    title: '分割线',
    prefix: '\n---\n',
    suffix: '',
    placeholder: ''
  }
]

export const KunMarkdownEditor = ({
  value,
  onChange,
  placeholder = '输入 Markdown 内容...',
  minHeight = 200,
  className
}: Props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write')
  const [contentHeight, setContentHeight] = useState(minHeight)
  const previewHtml = useMemo(() => markdownToPreviewHtml(value), [value])

  const insertFormatting = useCallback(
    (action: ToolbarAction) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = value.substring(start, end)
      const hasSelection = start !== end

      let newText: string
      let cursorOffset: number

      if (hasSelection) {
        newText =
          value.substring(0, start) +
          action.prefix +
          selectedText +
          action.suffix +
          value.substring(end)
        cursorOffset =
          start +
          action.prefix.length +
          selectedText.length +
          action.suffix.length
      } else {
        const placeholder = action.placeholder || action.label
        newText =
          value.substring(0, start) +
          action.prefix +
          placeholder +
          action.suffix +
          value.substring(end)
        cursorOffset =
          start +
          action.prefix.length +
          placeholder.length +
          (action.suffix ? 0 : 0)
      }

      onChange(newText)

      requestAnimationFrame(() => {
        textarea.focus()
        if (hasSelection) {
          textarea.setSelectionRange(cursorOffset, cursorOffset)
        } else {
          const selStart = start + action.prefix.length
          const selEnd = selStart + (action.placeholder || action.label).length
          textarea.setSelectionRange(selStart, selEnd)
        }
      })
    },
    [value, onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.key === 'b') {
        e.preventDefault()
        insertFormatting(TOOLBAR_ACTIONS[0])
      } else if (isMod && e.key === 'i') {
        e.preventDefault()
        insertFormatting(TOOLBAR_ACTIONS[1])
      } else if (isMod && e.key === 'k') {
        e.preventDefault()
        insertFormatting(TOOLBAR_ACTIONS[4])
      }

      if (e.key === 'Tab') {
        e.preventDefault()
        const textarea = textareaRef.current
        if (!textarea) return
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newText = value.substring(0, start) + '  ' + value.substring(end)
        onChange(newText)
        requestAnimationFrame(() => {
          textarea.focus()
          textarea.setSelectionRange(start + 2, start + 2)
        })
      }
    },
    [value, onChange, insertFormatting]
  )

  const autoResize = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const newHeight = Math.max(minHeight, textarea.scrollHeight)
    textarea.style.height = `${newHeight}px`
    setContentHeight(newHeight)
  }, [minHeight])

  useEffect(() => {
    autoResize()
  }, [value, autoResize])

  const wordCount = useMemo(() => {
    const cleaned = value.replace(/\s/g, '')
    return cleaned.length
  }, [value])

  return (
    <div
      className={cn(
        'kun-editor border-default-200 overflow-hidden rounded-xl border bg-content1 transition-colors',
        'focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-200/50',
        className
      )}
    >
      {/* Toolbar */}
      <div className="border-default-200 bg-default-50 flex items-center gap-0.5 border-b px-2 py-1.5">
        {TOOLBAR_ACTIONS.map((action) => (
          <Tooltip
            key={action.label}
            content={action.title}
            showArrow
            closeDelay={0}
            size="sm"
          >
            <Button
              variant="light"
              size="sm"
              isIconOnly
              className="text-default-500 hover:text-default-700 hover:bg-default-200 h-8 w-8 min-w-0 rounded-lg transition-colors"
              onPress={() => insertFormatting(action)}
            >
              <action.icon className="size-4" />
            </Button>
          </Tooltip>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="border-default-200 flex items-center border-b px-3">
        <button
          type="button"
          onClick={() => setActiveTab('write')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            activeTab === 'write'
              ? 'border-primary text-primary'
              : 'border-transparent text-default-500 hover:text-default-700'
          )}
        >
          <PenLine className="size-3.5" />
          编辑
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            activeTab === 'preview'
              ? 'border-primary text-primary'
              : 'border-transparent text-default-500 hover:text-default-700'
          )}
        >
          <Eye className="size-3.5" />
          预览
        </button>
      </div>

      {/* Content area */}
      <div className="relative">
        {activeTab === 'write' ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="text-default-800 placeholder:text-default-400 w-full resize-none bg-transparent px-4 py-3 text-sm leading-relaxed outline-none"
            style={{ height: `${contentHeight}px` }}
          />
        ) : (
          <div
            className="kun-prose overflow-y-auto px-4 py-3 text-sm"
            style={{ height: `${contentHeight}px` }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
      </div>

      {/* Footer */}
      <div className="border-default-200 bg-default-50 flex items-center justify-between border-t px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-default-400 text-xs font-medium">Markdown</span>
          <span className="text-default-300 text-xs">·</span>
          <span className="text-default-400 text-xs">Ctrl+B 加粗</span>
        </div>
        <span className="text-default-400 text-xs tabular-nums">
          {wordCount} 字
        </span>
      </div>
    </div>
  )
}
