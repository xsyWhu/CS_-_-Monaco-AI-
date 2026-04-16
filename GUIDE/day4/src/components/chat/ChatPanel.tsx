import { useEffect, useRef } from 'react'
import { Plus, Settings, Loader2 } from 'lucide-react'
import { useChatStore } from '../../stores/chat.store'
import { useChat } from '../../hooks/useChat'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'

/**
 * Day 4: Chat 面板——消息列表 + 流式指示器 + 输入框。
 *
 * 负责：
 * 1. 渲染消息列表并自动滚动到底部。
 * 2. 提供新建对话 / 打开设置的入口。
 * 3. 流式输出时显示 "Generating..." 指示器。
 */
export default function ChatPanel() {
  const messages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)

  const { sendMessage, newConversation } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 每次消息变化后自动滚动到底部。
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 h-10 min-h-10 border-b border-border">
        <span className="text-xs font-semibold tracking-wider text-gray-400">
          AI ASSISTANT
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={newConversation}
            className="p-1.5 rounded hover:bg-[#2a2d2e] text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="新建对话"
          >
            <Plus size={16} />
          </button>
          <button
            className="p-1.5 rounded hover:bg-[#2a2d2e] text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="设置（Day 4 暂不实现弹窗，请通过开发者工具调用 window.api.updateChatSettings）"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 select-none">
            <p className="text-sm">在下方输入框中发送消息</p>
            <p className="text-xs mt-1 opacity-60">按 Enter 发送，Shift+Enter 换行</p>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 流式输出指示器 */}
      {isStreaming && (
        <div className="flex items-center justify-center gap-2 py-1.5 text-xs text-gray-500 border-t border-border/50">
          <Loader2 size={12} className="animate-spin text-blue-400" />
          <span>Generating...</span>
        </div>
      )}

      {/* 输入区 */}
      <ChatInput onSend={sendMessage} isStreaming={isStreaming} />
    </div>
  )
}
