import { useRef, useState, useCallback, type KeyboardEvent, useEffect } from 'react'
import { SendHorizontal } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  isStreaming: boolean
}

/**
 * Day 8: 聊天输入框——统一设计语言。
 */
export default function ChatInput({ onSend, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [])

  useEffect(() => { adjustHeight() }, [value, adjustHeight])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isStreaming) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [value, isStreaming, onSend])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="p-3 border-t border-[var(--color-border)]">
      <div className="flex items-end gap-2 bg-[var(--color-bg-secondary)] rounded-lg
                      border border-[var(--color-border)] focus-within:border-[var(--color-accent)]
                      transition-base">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息，按 Enter 发送…"
          disabled={isStreaming}
          rows={1}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-[var(--color-fg-primary)]
                     placeholder:text-[var(--color-fg-muted)] resize-none outline-none
                     max-h-[160px] disabled:opacity-40"
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || isStreaming}
          className="p-2 m-1 rounded-md text-[var(--color-accent)]
                     hover:bg-[var(--color-bg-hover)]
                     disabled:opacity-20 disabled:cursor-not-allowed
                     transition-base cursor-pointer"
          title="发送消息"
        >
          <SendHorizontal size={16} />
        </button>
      </div>
    </div>
  )
}
