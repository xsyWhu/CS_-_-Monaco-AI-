import OpenAI from 'openai'
import type {
  LLMProvider,
  Message,
  ProviderConfig,
  StreamChunk,
  ToolCall,
  ToolDefinition,
} from './base.provider'

export default class OpenAIProvider implements LLMProvider {
  id: string
  name: string
  config: ProviderConfig
  private client: OpenAI

  constructor(config: ProviderConfig) {
    this.id = config.id
    this.name = config.name
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    })
  }

  async *chat(params: {
    messages: Message[]
    tools?: ToolDefinition[]
    stream: boolean
  }): AsyncIterable<StreamChunk> {
    try {
      const openaiMessages = params.messages.map((msg) => this.toOpenAIMessage(msg))

      const requestParams: OpenAI.ChatCompletionCreateParamsStreaming = {
        model: this.config.model,
        messages: openaiMessages,
        stream: true,
      }

      if (params.tools && params.tools.length > 0) {
        requestParams.tools = params.tools.map((t) => ({
          type: t.type as 'function',
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters as Record<string, unknown>,
          },
        }))
      }

      const stream = await this.client.chat.completions.create(requestParams)

      const activeToolCalls = new Map<number, { id: string; name: string; arguments: string }>()

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        if (!delta) continue

        if (delta.content) {
          yield { type: 'text_delta', content: delta.content }
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index

            if (tc.id) {
              activeToolCalls.set(idx, {
                id: tc.id,
                name: tc.function?.name ?? '',
                arguments: tc.function?.arguments ?? '',
              })

              const toolCall: Partial<ToolCall> = {
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.function?.name ?? '',
                  arguments: tc.function?.arguments ?? '',
                },
              }
              yield { type: 'tool_call_start', toolCall }
            } else {
              const existing = activeToolCalls.get(idx)
              if (existing) {
                if (tc.function?.name) {
                  existing.name += tc.function.name
                }
                if (tc.function?.arguments) {
                  existing.arguments += tc.function.arguments
                }

                yield {
                  type: 'tool_call_delta',
                  toolCall: {
                    id: existing.id,
                    type: 'function',
                    function: {
                      name: existing.name,
                      arguments: tc.function?.arguments ?? '',
                    },
                  },
                }
              }
            }
          }
        }

        const finishReason = chunk.choices[0]?.finish_reason
        if (finishReason) {
          for (const [, tc] of activeToolCalls) {
            yield {
              type: 'tool_call_end',
              toolCall: {
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: tc.arguments,
                },
              },
            }
          }
          activeToolCalls.clear()
        }
      }

      if (activeToolCalls.size > 0) {
        for (const [, tc] of activeToolCalls) {
          yield {
            type: 'tool_call_end',
            toolCall: {
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: tc.arguments,
              },
            },
          }
        }
        activeToolCalls.clear()
      }

      yield { type: 'done' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      yield { type: 'error', error: message }
    }
  }

  private toOpenAIMessage(
    msg: Message,
  ): OpenAI.ChatCompletionMessageParam {
    if (msg.role === 'tool') {
      return {
        role: 'tool',
        content: msg.content ?? '',
        tool_call_id: msg.tool_call_id ?? '',
      }
    }

    if (msg.role === 'assistant') {
      const result: OpenAI.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: msg.content,
      }
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        result.tool_calls = msg.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }))
      }
      return result
    }

    if (msg.role === 'system') {
      return { role: 'system', content: msg.content ?? '' }
    }

    return { role: 'user', content: msg.content ?? '' }
  }
}
