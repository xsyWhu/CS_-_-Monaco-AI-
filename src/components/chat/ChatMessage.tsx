import { User, Bot } from 'lucide-react'
import type { ChatMessage as ChatMessageType } from '@/types/agent.types'
import MarkdownRenderer from './MarkdownRenderer'
import ToolCallBlock from './ToolCallBlock'

interface Props {
  message: ChatMessageType
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] rounded px-3 py-1.5 max-w-[90%]">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
          isUser ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'
        }`}
      >
        {isUser ? (
          <User size={14} className="text-[var(--bg-primary)]" />
        ) : (
          <Bot size={14} className="text-[var(--accent)]" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? 'flex flex-col items-end' : ''}`}>
        <div
          className={`inline-block max-w-full text-left rounded-lg px-3 py-2 text-sm ${
            isUser ? 'bg-[var(--bg-tertiary)]' : ''
          }`}
        >
          {isUser ? (
            <p className="text-[var(--text-primary)] whitespace-pre-wrap break-words">
              {message.content}
            </p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-[var(--accent)] animate-pulse ml-0.5 align-middle rounded-sm" />
          )}
        </div>

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className={`mt-2 space-y-2 ${isUser ? 'w-full' : 'max-w-full'}`}>
            {message.toolCalls.map((tc) => (
              <ToolCallBlock key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        <p className="text-[10px] text-[var(--text-muted)] mt-1 select-none">{time}</p>
      </div>
    </div>
  )
}
