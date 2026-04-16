/**
 * Day 5: LLM Provider 基础接口定义（扩展版）。
 *
 * 相较 Day 4，本文件新增了：
 * 1. ToolCall / ToolDefinition —— Function Calling 所需的数据结构。
 * 2. Message.role 新增 'tool' —— 工具执行结果回传给模型的消息类型。
 * 3. StreamChunk 新增 tool_call_start / tool_call_end —— 流式工具调用事件。
 * 4. LLMProvider.chat() 新增 tools 可选参数。
 */

/**
 * 聊天消息。
 * - role: 'tool' 用于将工具执行结果发回给模型，必须携带 tool_call_id。
 * - content: assistant 的工具调用消息中 content 可以为 null。
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  // assistant 消息在决定调用工具时携带此字段。
  tool_calls?: ToolCall[]
  // tool 消息必须携带此字段，指向对应的 tool_call id。
  tool_call_id?: string
}

/**
 * 工具调用描述。
 * id: 单次调用的唯一标识，用于将结果与调用对应。
 * function.arguments: JSON 字符串，由模型按工具 JSON Schema 生成。
 */
export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string // JSON 字符串
  }
}

/**
 * 工具定义（传给 API 的格式）。
 * OpenAI 要求 tools 字段是数组，每个元素包含：
 * - type: 固定为 'function'
 * - function.name / description / parameters（JSON Schema）
 */
export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/**
 * 流式输出块。
 * Day 5 新增 tool_call_start / tool_call_end 两种类型：
 * - tool_call_start: 模型开始生成某个 tool_call（携带 id + name）。
 * - tool_call_end:   该 tool_call 参数全部生成完毕（携带完整参数）。
 */
export interface StreamChunk {
  type: 'text_delta' | 'tool_call_start' | 'tool_call_end' | 'done' | 'error'
  content?: string
  toolCall?: Partial<ToolCall>
  error?: string
}

// Provider 配置。Day 8: 新增 systemPrompt / maxIterations / temperature。
export interface ProviderConfig {
  apiKey: string
  baseURL: string
  model: string
  systemPrompt?: string
  maxIterations?: number
  temperature?: number
}

// 所有 Provider 必须实现的接口（新增 tools 可选参数）。
export interface LLMProvider {
  chat(params: {
    messages: Message[]
    tools?: ToolDefinition[] // 传入则开启 Function Calling
    stream: boolean
    temperature?: number
  }): AsyncIterable<StreamChunk>
}
