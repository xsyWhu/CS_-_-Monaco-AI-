export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface StreamChunk {
  type: 'text_delta' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'done' | 'error'
  content?: string
  toolCall?: Partial<ToolCall>
  error?: string
}

export interface ProviderConfig {
  id: string
  name: string
  apiKey: string
  baseURL: string
  model: string
}

export interface LLMProvider {
  id: string
  name: string
  config: ProviderConfig
  chat(params: {
    messages: Message[]
    tools?: ToolDefinition[]
    stream: boolean
  }): AsyncIterable<StreamChunk>
}
