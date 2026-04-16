import { User, Bot } from "lucide-react"
import ToolCallBlock from "./ToolCallBlock"

interface ChatMessageProps {
  message: ChatMessageData
}

/**
 * Day 8: 消息气泡——带入场动画、统一设计语言。
 */
export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  // 系统消息
  if (message.role === "system") {
    return (
      <div className="flex justify-center animate-fade-in">
        <div className="text-[11px] text-[var(--color-fg-muted)] bg-[var(--color-bg-tertiary)]
                        rounded-full px-3 py-1 max-w-[90%]">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse animate-slide-right" : "animate-slide-left"}`}>
      {/* 头像 */}
      <div
        className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5
          ${isUser
            ? "bg-[var(--color-accent)]"
            : "bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
          }`}
      >
        {isUser ? (
          <User size={13} className="text-white" />
        ) : (
          <Bot size={13} className="text-[var(--color-accent)]" />
        )}
      </div>

      {/* 内容区 */}
      <div className={`flex-1 min-w-0 ${isUser ? "flex flex-col items-end" : ""}`}>
        <div
          className={`inline-block max-w-full text-left rounded-lg px-3 py-2 text-[13px] leading-relaxed
            ${isUser
              ? "bg-[var(--color-accent-muted)] border border-[var(--color-accent)]/20"
              : ""
            }`}
        >
          <p className="text-[var(--color-fg-primary)] whitespace-pre-wrap break-words">
            {message.content}
          </p>
          {/* 流式光标 */}
          {message.isStreaming && !message.toolCalls?.length && (
            <span className="inline-block w-1.5 h-4 bg-[var(--color-accent)] animate-typing-cursor
                             ml-0.5 align-middle rounded-sm" />
          )}
        </div>

        {/* 工具调用块 */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="w-full mt-2 space-y-1">
            {message.toolCalls.map((tc) => (
              <ToolCallBlock key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        <p className="text-[10px] text-[var(--color-fg-muted)] mt-1 select-none opacity-60">{time}</p>
      </div>
    </div>
  )
}