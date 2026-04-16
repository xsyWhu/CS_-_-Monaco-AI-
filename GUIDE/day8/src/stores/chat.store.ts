/**
 * Day 6: Chat 全局状态管理（扩展版）。
 *
 * 相较 Day 5 新增：
 * 1. isThinking —— 模型进入推理阶段但尚未输出文字时为 true（"思考中" UI）。
 * 2. iteration / maxIteration —— 当前 / 最大迭代轮次（进度 UI）。
 * 3. handleThinking() / handleIteration() —— 对应新事件的 action。
 * 4. abortChat() —— 调用 window.api.abortChat() 中断 AgentLoop。
 */

import { create } from "zustand"

interface ChatState {
  messages: ChatMessageData[]
  isStreaming: boolean
  currentStreamText: string
  // Day 6 新增
  isThinking: boolean
  iteration: number
  maxIteration: number

  sendMessage: (content: string, workspacePath: string) => Promise<void>
  appendToken: (token: string) => void
  handleComplete: (fullText: string) => void
  handleError: (error: string) => void
  newConversation: () => void
  handleToolCall: (info: { id: string; name: string; args: string }) => void
  handleToolResult: (info: { id: string; name: string; result: string; isError: boolean }) => void
  // Day 6 新增
  handleThinking: () => void
  handleIteration: (current: number, max: number) => void
  abortChat: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentStreamText: "",
  isThinking: false,
  iteration: 0,
  maxIteration: 10,

  sendMessage: async (content: string, workspacePath: string) => {
    const userMsg: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: Date.now(),
    }
    const assistantMsg: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: true,
      toolCalls: [],
    }
    set((state) => ({
      messages: [...state.messages, userMsg, assistantMsg],
      isStreaming: true,
      currentStreamText: "",
      isThinking: false,
      iteration: 0,
    }))
    try {
      await window.api.sendChatMessage(content, workspacePath)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      get().handleError(message)
    }
  },

  appendToken: (token: string) => {
    set((state) => {
      const newStreamText = state.currentStreamText + token
      const messages = [...state.messages]
      const lastIdx = messages.length - 1
      if (lastIdx >= 0 && messages[lastIdx].isStreaming) {
        messages[lastIdx] = { ...messages[lastIdx], content: newStreamText }
      }
      // 模型开始输出文字，退出"思考中"状态。
      return { messages, currentStreamText: newStreamText, isThinking: false }
    })
  },

  handleComplete: (_fullText: string) => {
    set((state) => {
      const messages = [...state.messages]
      const lastIdx = messages.length - 1
      if (lastIdx >= 0 && messages[lastIdx].isStreaming) {
        messages[lastIdx] = { ...messages[lastIdx], isStreaming: false }
      }
      return { messages, isStreaming: false, currentStreamText: "", isThinking: false, iteration: 0 }
    })
  },

  handleError: (error: string) => {
    set((state) => {
      const messages = [...state.messages]
      const lastIdx = messages.length - 1
      if (lastIdx >= 0 && messages[lastIdx].isStreaming) {
        messages[lastIdx] = { ...messages[lastIdx], content: "错误：" + error, isStreaming: false }
      }
      return { messages, isStreaming: false, currentStreamText: "", isThinking: false, iteration: 0 }
    })
  },

  newConversation: () => {
    window.api.clearChat()
    set({ messages: [], isStreaming: false, currentStreamText: "", isThinking: false, iteration: 0 })
  },

  handleToolCall: (info: { id: string; name: string; args: string }) => {
    set((state) => {
      const messages = [...state.messages]
      const lastIdx = messages.length - 1
      if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
        const prev = messages[lastIdx]
        const newToolCall: ToolCallInfo = { id: info.id, name: info.name, args: info.args, status: "running" }
        messages[lastIdx] = {
          ...prev,
          toolCalls: [...(prev.toolCalls ?? []), newToolCall],
        }
      }
      // 正在调用工具，退出"思考中"状态（工具卡片将接管 UI）。
      return { messages, isThinking: false }
    })
  },

  handleToolResult: (info: { id: string; name: string; result: string; isError: boolean }) => {
    set((state) => {
      const messages = state.messages.map((msg) => {
        if (msg.role !== "assistant" || !msg.toolCalls) return msg
        const toolCalls = msg.toolCalls.map((tc) =>
          tc.id === info.id
            ? { ...tc, status: (info.isError ? "error" : "completed") as ToolCallInfo["status"], result: info.result }
            : tc,
        )
        return { ...msg, toolCalls }
      })
      return { messages }
    })
  },

  // Day 6 新增：模型进入推理阶段（接收到 chat:thinking 事件）。
  handleThinking: () => {
    set({ isThinking: true })
  },

  // Day 6 新增：迭代轮次更新（接收到 chat:iteration 事件）。
  handleIteration: (current: number, max: number) => {
    set({ iteration: current, maxIteration: max })
  },

  // Day 6 新增：中断 AgentLoop。
  abortChat: () => {
    window.api.abortChat()
  },
}))