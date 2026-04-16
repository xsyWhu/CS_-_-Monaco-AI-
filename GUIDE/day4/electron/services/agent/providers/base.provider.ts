/**
 * Day 4: LLM Provider 基础接口定义。
 *
 * 所有 LLM 提供商（OpenAI、Claude、本地模型等）都实现这套接口，
 * 上层 ChatService 不关心具体实现，只依赖接口编程。
 */

// 聊天消息结构：role 决定消息来源（系统/用户/助手）。
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// 流式输出里的每一块数据，按 type 区分含义。
export interface StreamChunk {
  type: 'text_delta' | 'done' | 'error'
  content?: string
  error?: string
}

// Provider 配置：连接 LLM 所需的最小信息集合。
export interface ProviderConfig {
  apiKey: string
  baseURL: string
  model: string
}

// 所有 Provider 必须实现的接口。
export interface LLMProvider {
  // 流式聊天：返回异步迭代器，逐块产出文本增量。
  chat(params: {
    messages: ChatMessage[]
    stream: boolean
  }): AsyncIterable<StreamChunk>
}
