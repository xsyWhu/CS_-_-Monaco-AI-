import { useEffect, useRef } from 'react'
import { Plus, Settings, Loader2, BrainCircuit, Square } from 'lucide-react'
import { useChatStore } from '../../stores/chat.store'
import { useChat } from '../../hooks/useChat'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'

/**
 * Day 6: Chat 面板（扩展版）。
 *
 * 相较 Day 5 新增：
 * 1. 「思考中」指示器：模型进入推理阶段时（isThinking=true）显示带动画的脉冲图标，
 *    区别于流式输出的旋转 Loader，帮助用户理解 Agent 当前处于哪个阶段。
 * 2. 「迭代轮次」进度徽章：isStreaming 时在顶栏右侧显示 "轮次 N/M"，
 *    让用户直观了解 Agent 已进行了多少轮推理-执行循环。
 * 3. 「取消」按钮：isStreaming 时出现在顶栏，点击后调用 abortChat()，
 *    向主进程发送 chat:abort 消息打断 AgentLoop。
 *
 * AgentLoop 的状态机可视化：
 *   [isThinking]   → 脑电图标脉冲（模型推理中，尚无文字输出）
 *   [isStreaming]  → 文字流式滚动（模型输出文字）
 *   [toolCalls]    → ToolCallBlock 列表（工具执行中 / 完成）
 *   [完成]         → 所有指示器消失
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
    <div className="h-full flex flex-col bg-background">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 h-10 min-h-10 border-b border-border">
        <span className="text-xs font-semibold tracking-wider text-gray-400">AI ASSISTANT</span>
        <div className="flex items-center gap-2">
          {/* 迭代轮次：Agent 正在运行时展示 */}
          {isStreaming && iteration > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-mono select-none">
              轮次 {iteration}/{maxIteration}
            </span>
          )}
          {/* 取消按钮：Agent 正在运行时展示 */}
          {isStreaming && (
            <button
              onClick={abortChat}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
              title="中断 Agent"
            >
              <Square size={10} className="fill-current" />
              取消
            </button>
          )}
          <button
            onClick={newConversation}
            className="p-1.5 rounded hover:bg-[#2a2d2e] text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="新建对话"
          >
            <Plus size={16} />
          </button>
          <button
            className="p-1.5 rounded hover:bg-[#2a2d2e] text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="设置"
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
            <p className="text-xs mt-3 opacity-40">Agent 可读取、搜索、写入工作区文件</p>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 状态指示区：思考中 / 生成中 */}
      {isStreaming && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-t border-border/50 text-xs text-gray-500">
          {isThinking ? (
            // 「思考中」：模型在推理，尚无文字输出
            <>
              <BrainCircuit
                size={13}
                className="text-purple-400 animate-pulse"
              />
              <span className="text-purple-400">思考中...</span>
            </>
          ) : (
            // 「生成中」：模型正在输出文字
            <>
              <Loader2 size={12} className="animate-spin text-blue-400" />
              <span>生成中...</span>
            </>
          )}
        </div>
      )}

      {/* 输入区 */}
      <ChatInput onSend={sendMessage} isStreaming={isStreaming} />
    </div>
  )
}