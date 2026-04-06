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
  switchConversation: (conversationId: string) => Promise<void>
  deleteConversation: (conversationId: string) => Promise<void>
  newConversation: () => void
  clearMessages: () => void
}

// Helper function to convert backend Message to frontend ChatMessage
function convertMessagesToChatFormat(messages: any[], conversationId?: string): ChatMessage[] {
  if (!Array.isArray(messages)) return []
  
  return messages.map((msg, index) => {
    // Generate a stable ID based on conversation ID, message index, and content hash
    // This ensures the same ID across multiple loads but still unique per message
    let messageId: string
    if (msg.id) {
      messageId = msg.id
    } else {
      // Create a deterministic ID from conversation + index + content prefix
      const contentHash = msg.content?.substring(0, 20).replace(/[^a-z0-9]/gi, '') || 'empty'
      messageId = `${conversationId || 'local'}-${index}-${msg.role}-${contentHash}`
    }
    
    return {
      id: messageId,
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content || '',
      timestamp: msg.timestamp || 0, // Use 0 for historical messages so they sort correctly
      toolCalls: msg.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function?.name || tc.name || '',
        arguments: tc.function?.arguments || tc.arguments,
        result: tc.result,
        status: tc.status || 'completed' as const,
      })) || undefined,
      isStreaming: false, // Historical messages are never streaming
    }
  })
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
      return conversationId
    } catch (error) {
      console.error('Failed to send message:', error)
      set({ isStreaming: false })
      throw error
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

  switchConversation: async (conversationId: string) => {
    try {
      const conversation = await window.api.getConversation(conversationId)
      if (conversation) {
        const convertedMessages = convertMessagesToChatFormat(conversation.messages, conversationId)
        set({
          conversationId,
          messages: convertedMessages,
          isStreaming: false,
          currentStreamText: '',
        })
      }
    } catch (error) {
      console.error('Failed to switch conversation:', error)
    }
  },

  deleteConversation: async (conversationId: string) => {
    try {
      await window.api.deleteConversation(conversationId)
      await get().loadConversations()
      // If deleted conv is current, clear messages
      if (get().conversationId === conversationId) {
        get().newConversation()
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
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
