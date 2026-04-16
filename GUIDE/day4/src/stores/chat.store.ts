/**
 * Day 4: Chat 全局状态管理。
 *
 * 核心状态：消息列表 + 是否正在流式输出 + 当前流式文本。
 * 设计原则：渲染层不直接调用 IPC，而是通过 store action 组合
 * invoke（发起请求）与 on/off（监听推送），保持组件简洁。
 */

import { create } from 'zustand'

interface ChatState {
  messages: ChatMessageData[]
  isStreaming: boolean
  currentStreamText: string

  // 发送消息：创建 user + streaming assistant 条目，调用 IPC。
  sendMessage: (content: string) => Promise<void>
  // 追加流式 token 到最后一条 assistant 消息。
  appendToken: (token: string) => void
  // 流式完成：固定最终文本并关闭 streaming 标志。
  handleComplete: (fullText: string) => void
  // 流式错误：写入错误文本并关闭 streaming 标志。
  handleError: (error: string) => void
  // 新建对话（清空前端 + 通知后端）。
  newConversation: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentStreamText: '',

  sendMessage: async (content: string) => {
    const userMsg: ChatMessageData = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now()
    }

    const assistantMsg: ChatMessageData = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true
    }

    set((state) => ({
      messages: [...state.messages, userMsg, assistantMsg],
      isStreaming: true,
      currentStreamText: ''
    }))

    try {
      await window.api.sendChatMessage(content)
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

  handleComplete: (fullText: string) => {
    set((state) => {
      const messages = [...state.messages]
      const lastIdx = messages.length - 1

      if (lastIdx >= 0 && messages[lastIdx].isStreaming) {
        messages[lastIdx] = {
          ...messages[lastIdx],
          content: fullText || state.currentStreamText,
          isStreaming: false
        }
      }

      return { messages, isStreaming: false, currentStreamText: '' }
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
          isStreaming: false
        }
      }

      return { messages, isStreaming: false, currentStreamText: '' }
    })
  },

  newConversation: () => {
    window.api.clearChat()
    set({ messages: [], isStreaming: false, currentStreamText: '' })
  }
}))
