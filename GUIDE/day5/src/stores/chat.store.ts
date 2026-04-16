/**
 * Day 5: Chat 全局状态管理（扩展版）。
 *
 * 相较 Day 4，主要变化：
 * 1. sendMessage 新增 workspacePath 参数，透传给主进程工具执行。
 * 2. 新增 handleToolCall / handleToolResult 动作，
 *    在最后一条 assistant 消息的 toolCalls 数组中维护工具调用状态。
 */

import { create } from "zustand"

interface ChatState {
  messages: ChatMessageData[]
  isStreaming: boolean
  currentStreamText: string

  sendMessage: (content: string, workspacePath: string) => Promise<void>
  appendToken: (token: string) => void
  handleComplete: (fullText: string) => void
  handleError: (error: string) => void
  newConversation: () => void
  // Day 5 新增
  handleToolCall: (info: { id: string; name: string; args: string }) => void
  handleToolResult: (info: { id: string; result: string; isError: boolean }) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentStreamText: "",

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
      toolCalls: [], // 初始化空数组，等待工具调用事件填充。
    }

    set((state) => ({
      messages: [...state.messages, userMsg, assistantMsg],
      isStreaming: true,
      currentStreamText: "",
    }))

    try {
      // Day 5: 传入 workspacePath 供主进程工具执行使用。
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

      return { messages, currentStreamText: newStreamText }
    })
  },

  handleComplete: (_fullText: string) => {
    set((state) => {
      const messages = [...state.messages]
      const lastIdx = messages.length - 1

      if (lastIdx >= 0 && messages[lastIdx].isStreaming) {
        messages[lastIdx] = { ...messages[lastIdx], isStreaming: false }
      }

      return { messages, isStreaming: false, currentStreamText: "" }
    })
  },

  handleError: (error: string) => {
    set((state) => {
      const messages = [...state.messages]
      const lastIdx = messages.length - 1

      if (lastIdx >= 0 && messages[lastIdx].isStreaming) {
        messages[lastIdx] = {
          ...messages[lastIdx],
          content: `错误：${error}`,
          isStreaming: false,
        }
      }

      return { messages, isStreaming: false, currentStreamText: "" }
    })
  },

  newConversation: () => {
    window.api.clearChat()
    set({ messages: [], isStreaming: false, currentStreamText: "" })
  },

  /**
   * 工具调用开始：在最后一条 assistant 消息的 toolCalls 数组中追加一条
   * status=running 的记录，并更新消息内容（新增"正在调用工具..."提示）。
   */
  handleToolCall: (info: { id: string; name: string; args: string }) => {
    set((state) => {
      const messages = [...state.messages]
      const lastIdx = messages.length - 1

      if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
        const prev = messages[lastIdx]
        const newToolCall: ToolCallInfo = {
          id: info.id,
          name: info.name,
          args: info.args,
          status: "running",
        }
        messages[lastIdx] = {
          ...prev,
          toolCalls: [...(prev.toolCalls ?? []), newToolCall],
        }
      }

      return { messages }
    })
  },

  /**
   * 工具调用完成：找到对应 id 的 toolCall 记录，
   * 更新 status 和 result。
   */
  handleToolResult: (info: { id: string; result: string; isError: boolean }) => {
    set((state) => {
      const messages = [...state.messages]
      const lastIdx = messages.length - 1

      if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
        const prev = messages[lastIdx]
        const updatedToolCalls = (prev.toolCalls ?? []).map((tc) =>
          tc.id === info.id
            ? { ...tc, status: info.isError ? ("error" as const) : ("completed" as const), result: info.result }
            : tc,
        )
        messages[lastIdx] = { ...prev, toolCalls: updatedToolCalls }
      }

      return { messages }
    })
  },
}))