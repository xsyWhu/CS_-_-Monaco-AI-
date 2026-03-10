import { useRef, useState, useCallback, type KeyboardEvent, useEffect } from 'react'
import { SendHorizontal, Square } from 'lucide-react'

interface Props {
  onSend: (message: string) => void
  isStreaming: boolean
  onCancel: () => void
}

export default function ChatInput({ onSend, isStreaming, onCancel }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isStreaming) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, isStreaming, onSend])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="p-3 border-t border-[var(--border)]">
      <div className="flex items-end gap-2 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)] focus-within:border-[var(--accent)] transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the AI assistant..."
          disabled={isStreaming}
          rows={1}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-none max-h-[200px] disabled:opacity-50"
        />
        {isStreaming ? (
          <button
            onClick={onCancel}
            className="p-2 m-1 rounded-md bg-[var(--error)]/20 text-[var(--error)] hover:bg-[var(--error)]/30 transition-colors"
            title="Cancel generation"
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim()}
            className="p-2 m-1 rounded-md text-[var(--accent)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Send message"
          >
            <SendHorizontal size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
