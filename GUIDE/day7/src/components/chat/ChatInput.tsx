import { useRef, useState, useCallback, type KeyboardEvent, useEffect } from 'react'
import { SendHorizontal } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  isStreaming: boolean
}

/**
 * Day 4: 聊天输入框。
 * 支持 Enter 发送、Shift+Enter 换行、自动高度调节。
 */
export default function ChatInput({ onSend, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 根据内容自动调节高度，最大 160px。
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
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
    <div className="p-3 border-t border-border">
      <div className="flex items-end gap-2 bg-surface rounded-lg border border-border focus-within:border-blue-500 transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息，按 Enter 发送..."
          disabled={isStreaming}
          rows={1}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-gray-500 resize-none outline-none max-h-[160px] disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || isStreaming}
          className="p-2 m-1 rounded-md text-blue-400 hover:bg-[#2a2d2e] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="发送消息"
        >
          <SendHorizontal size={16} />
        </button>
      </div>
    </div>
  )
}
