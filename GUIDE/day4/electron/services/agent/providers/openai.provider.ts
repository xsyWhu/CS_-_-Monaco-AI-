/**
 * Day 4: OpenAI / 兼容端点 Provider 实现。
 *
 * 核心能力：接收消息列表，调用 OpenAI SDK 流式接口，
 * 将增量文本通过 AsyncIterable<StreamChunk> 逐块产出。
 *
 * 兼容性：只要 API 实现了 OpenAI Chat Completions 协议（如 DeepSeek、
 * Moonshot、本地 Ollama 等），都可以通过修改 baseURL 接入。
 */

import OpenAI from 'openai'
import type {
  LLMProvider,
  ChatMessage,
  ProviderConfig,
  StreamChunk
} from './base.provider'

export default class OpenAIProvider implements LLMProvider {
  private client: OpenAI

  constructor(private config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    })
  }

  /**
   * 流式聊天实现。
   * 使用 async generator（async function*）逐块 yield StreamChunk，
   * 调用方通过 for-await-of 消费。
   */
  async *chat(params: {
    messages: ChatMessage[]
    stream: boolean
  }): AsyncIterable<StreamChunk> {
    try {
      // 将内部消息结构映射为 OpenAI SDK 所需格式。
      const openaiMessages: OpenAI.ChatCompletionMessageParam[] = params.messages.map((msg) => ({
        role: msg.role,
        content: msg.content
      }))

      // 发起流式请求。
      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        messages: openaiMessages,
        stream: true
      })

      // 逐块读取并转换为统一格式。
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        if (!delta) continue

        if (delta.content) {
          yield { type: 'text_delta', content: delta.content }
        }
      }

      // 所有块消费完毕，告知下游流结束。
      yield { type: 'done' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      yield { type: 'error', error: message }
    }
  }
}
