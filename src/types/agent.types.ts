export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  toolCalls?: ToolCallInfo[]
  isStreaming?: boolean
}

export interface ToolCallInfo {
  id: string
  name: string
  arguments?: string
  result?: string
  status: 'pending' | 'running' | 'completed' | 'error'
}

export interface ConversationInfo {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export interface ProviderSettings {
  id: string
  name: string
  apiKey: string
  baseURL: string
  model: string
}
