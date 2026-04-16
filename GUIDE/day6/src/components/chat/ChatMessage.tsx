import { User, Bot } from "lucide-react"
import ToolCallBlock from "./ToolCallBlock"

interface ChatMessageProps {
  message: ChatMessageData
}

/**
 * Day 5: 单条消息渲染（新增工具调用块展示）。
 * - 用户消息右对齐。
 * - 助手消息左对齐，消息体下方渲染工具调用列表。
 * - 流式输出时显示光标动画。
 */
export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  // 系统消息居中显示。
  if (message.role === "system") {
    return (
      <div className="flex justify-center">
        <div className="text-xs text-gray-500 bg-surface rounded px-3 py-1.5 max-w-[90%]">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* 头像 */}
      <div
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
          isUser ? "bg-blue-600" : "bg-surface"
        }`}
      >
        {isUser ? (
          <User size={14} className="text-white" />
        ) : (
          <Bot size={14} className="text-blue-400" />
        )}
      </div>

      {/* 内容区 */}
      <div className={`flex-1 min-w-0 ${isUser ? "flex flex-col items-end" : ""}`}>
        <div
          className={`inline-block max-w-full text-left rounded-lg px-3 py-2 text-sm ${
            isUser ? "bg-surface" : ""
          }`}
        >
          {/* 文本内容 */}
          <p className="text-foreground whitespace-pre-wrap break-words">{message.content}</p>
          {/* 流式光标 */}
          {message.isStreaming && !message.toolCalls?.length && (
            <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-middle rounded-sm" />
          )}
        </div>

        {/* Day 5 新增：工具调用块列表（仅 assistant 消息可能有） */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="w-full mt-2 space-y-1">
            {message.toolCalls.map((tc) => (
              <ToolCallBlock key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        <p className="text-[10px] text-gray-600 mt-1 select-none">{time}</p>
      </div>
    </div>
  )
}