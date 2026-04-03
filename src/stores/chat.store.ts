import { create } from 'zustand'
import type { ChatMessage, ConversationInfo, ToolCallInfo } from '@/types/agent.types'
import { useFileTreeStore } from './file-tree.store'

interface ChatState {
  messages: ChatMessage[]
  conversationId: string | null
  conversations: ConversationInfo[]
  isStreaming: boolean
  currentStreamText: string
  sendMessage: (content: string) => Promise<void>
  appendStreamToken: (token: string) => void
  replaceStreamText: (text: string) => void
  handleToolCall: (toolCall: ToolCallInfo) => void
  handleComplete: (response: string) => void
  handleError: (error: string) => void
  cancelStream: () => Promise<void>
  loadConversations: () => Promise<void>
  newConversation: () => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  conversationId: null,
  conversations: [],
  isStreaming: false,
  currentStreamText: '',

  sendMessage: async (content: string) => {
    try {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now(),
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      }

      set((state) => ({
        messages: [...state.messages, userMessage, assistantMessage],
        isStreaming: true,
        currentStreamText: '',
      }))

      const workspacePath = useFileTreeStore.getState().rootPath || undefined
      const conversationId = await window.api.sendMessage(
        content,
        get().conversationId ?? undefined,
        workspacePath,
      )
      set({ conversationId })
    } catch (error) {
      console.error('Failed to send message:', error)
      set({ isStreaming: false })
    }
  },

  appendStreamToken: (token: string) => {
    set((state) => {
      const newStreamText = state.currentStreamText + token
      const messages = [...state.messages]
      const lastIndex = messages.length - 1

      if (lastIndex >= 0 && messages[lastIndex].isStreaming) {
        messages[lastIndex] = {
          ...messages[lastIndex],
          content: newStreamText,
        }
      }

      return { messages, currentStreamText: newStreamText }
    })
  },

  replaceStreamText: (text: string) => {
    set((state) => {
      const messages = [...state.messages]
      const lastIndex = messages.length - 1

      if (lastIndex >= 0 && messages[lastIndex].isStreaming) {
        messages[lastIndex] = {
          ...messages[lastIndex],
          content: text,
        }
      }

      return { messages, currentStreamText: text }
    })
  },

  handleToolCall: (toolCall: ToolCallInfo) => {
    set((state) => {
      const messages = [...state.messages]
      const lastIndex = messages.length - 1

      if (lastIndex >= 0 && messages[lastIndex].isStreaming) {
        const existing = messages[lastIndex].toolCalls || []
        const toolCallIndex = existing.findIndex((tc) => tc.id === toolCall.id)

        let updatedToolCalls: ToolCallInfo[]
        if (toolCallIndex >= 0) {
          updatedToolCalls = [...existing]
          updatedToolCalls[toolCallIndex] = toolCall
        } else {
          updatedToolCalls = [...existing, toolCall]
        }

        messages[lastIndex] = {
          ...messages[lastIndex],
          toolCalls: updatedToolCalls,
        }
      }

      return { messages }
    })
  },

  handleComplete: (response: string) => {
    set((state) => {
      const messages = [...state.messages]
      const lastIndex = messages.length - 1

      if (lastIndex >= 0 && messages[lastIndex].isStreaming) {
        messages[lastIndex] = {
          ...messages[lastIndex],
          content: response || state.currentStreamText,
          isStreaming: false,
        }
      }

      return {
        messages,
        isStreaming: false,
        currentStreamText: '',
      }
    })
  },

  handleError: (error: string) => {
    set((state) => {
      const messages = [...state.messages]
      const lastIndex = messages.length - 1

      if (lastIndex >= 0 && messages[lastIndex].isStreaming) {
        messages[lastIndex] = {
          ...messages[lastIndex],
          content: `Error: ${error}`,
          isStreaming: false,
        }
      } else {
        messages.push({
          id: crypto.randomUUID(),
          role: 'system',
          content: `Error: ${error}`,
          timestamp: Date.now(),
        })
      }

      return {
        messages,
        isStreaming: false,
        currentStreamText: '',
      }
    })
  },

  cancelStream: async () => {
    try {
      const { conversationId } = get()
      if (conversationId) {
        await window.api.cancelAgent(conversationId)
      }
      set((state) => {
        const messages = [...state.messages]
        const lastIndex = messages.length - 1

        if (lastIndex >= 0 && messages[lastIndex].isStreaming) {
          messages[lastIndex] = {
            ...messages[lastIndex],
            isStreaming: false,
          }
        }

        return { messages, isStreaming: false, currentStreamText: '' }
      })
    } catch (error) {
      console.error('Failed to cancel stream:', error)
    }
  },

  loadConversations: async () => {
    try {
      const conversations = await window.api.getConversations()
      set({ conversations })
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  },

  newConversation: () => {
    set({
      messages: [],
      conversationId: null,
      isStreaming: false,
      currentStreamText: '',
    })
  },

  clearMessages: () => {
    set({ messages: [], currentStreamText: '' })
  },
}))
