import { useEffect, useRef } from 'react'
import { Plus, Loader2, BrainCircuit, Square, Bot } from 'lucide-react'
import { useChatStore } from '../../stores/chat.store'
import { useChat } from '../../hooks/useChat'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'

/**
 * Day 8: Chat 面板重构——移除无用设置按钮，统一设计语言。
 */
export default function ChatPanel() {
  const messages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const isThinking = useChatStore((s) => s.isThinking)
  const iteration = useChatStore((s) => s.iteration)
  const maxIteration = useChatStore((s) => s.maxIteration)

  const { sendMessage, newConversation, abortChat } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-primary)]">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 h-10 min-h-10 border-b border-[var(--color-border)]
                      bg-[var(--color-bg-secondary)]">
        <span className="text-[11px] font-semibold tracking-widest text-[var(--color-fg-muted)] uppercase select-none">
          AI Assistant
        </span>
        <div className="flex items-center gap-1.5">
          {/* 迭代轮次 */}
          {isStreaming && iteration > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent-muted)]
                             text-[var(--color-accent)] font-mono select-none animate-fade-in">
              {iteration}/{maxIteration}
            </span>
          )}
          {/* 取消按钮 */}
          {isStreaming && (
            <button
              onClick={abortChat}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px]
                         bg-[rgba(248,113,113,0.08)] text-[var(--color-error)]
                         hover:bg-[rgba(248,113,113,0.15)] transition-base cursor-pointer animate-fade-in"
              title="中断 Agent"
            >
              <Square size={9} className="fill-current" />
              停止
            </button>
          )}
          {/* 新建对话 */}
          <button
            onClick={newConversation}
            className="p-1.5 rounded hover:bg-[var(--color-bg-hover)]
                       text-[var(--color-fg-muted)] hover:text-[var(--color-fg-primary)]
                       transition-base cursor-pointer"
            title="新建对话"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--color-fg-muted)] select-none gap-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-accent-muted)] flex items-center justify-center">
              <Bot size={24} className="text-[var(--color-accent)]" />
            </div>
            <p className="text-sm text-[var(--color-fg-secondary)]">开始对话</p>
            <div className="text-[11px] opacity-50 text-center leading-relaxed">
              <p>输入消息与 AI 助手交互</p>
              <p>Agent 可读取、编辑、搜索工作区文件</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 状态指示 */}
      {isStreaming && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-t border-[var(--color-border-subtle)]
                        text-xs animate-fade-in">
          {isThinking ? (
            <>
              <BrainCircuit size={13} className="text-purple-400 animate-pulse" />
              <span className="text-purple-400">思考中…</span>
            </>
          ) : (
            <>
              <Loader2 size={12} className="animate-spin text-[var(--color-accent)]" />
              <span className="text-[var(--color-fg-muted)]">生成中…</span>
            </>
          )}
        </div>
      )}

      {/* 输入区 */}
      <ChatInput onSend={sendMessage} isStreaming={isStreaming} />
    </div>
  )
}