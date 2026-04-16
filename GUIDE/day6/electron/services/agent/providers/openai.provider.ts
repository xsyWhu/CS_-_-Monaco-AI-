/**
 * Day 5: OpenAI Provider——支持 Function Calling 的流式实现。
 *
 * 相较 Day 4，核心变化：
 * 1. chat() 接收可选 tools 参数，传给 API 时映射为 OpenAI 格式。
 * 2. 流式解析中处理 delta.tool_calls 字段，逐步拼装 tool_call 数据。
 * 3. 通过 tool_call_start / tool_call_end chunk 通知上层开始/完成一次工具调用。
 *
 * OpenAI 流式 Function Calling 的特点：
 * - tool_call 的 name 和 id 在第一个 chunk（index 首次出现时）给出。
 * - arguments 是增量拼接的：每个后续 chunk 追加字符串片段。
 * - finish_reason === "tool_calls" 时表示本轮工具调用全部生成完毕。
 */

import OpenAI from "openai"
import type { LLMProvider, Message, ProviderConfig, StreamChunk, ToolDefinition } from "./base.provider"

export default class OpenAIProvider implements LLMProvider {
  private client: OpenAI
  private config: ProviderConfig

  constructor(config: ProviderConfig) {
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
      // 将统一 Message 格式转换成 OpenAI API 接受的格式。
      const openaiMessages = params.messages.map((msg) => this.toOpenAIMessage(msg))

      const requestParams: OpenAI.ChatCompletionCreateParamsStreaming = {
        model: this.config.model,
        messages: openaiMessages,
        stream: true,
      }

      // 仅在有工具定义时才传递 tools 字段，避免空数组导致模型异常。
      if (params.tools && params.tools.length > 0) {
        requestParams.tools = params.tools.map((t) => ({
          type: "function" as const,
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters as Record<string, unknown>,
          },
        }))
      }

      const stream = await this.client.chat.completions.create(requestParams)

      /**
       * 正在拼装的工具调用集合。
       * key = stream delta 中的 index（每次响应的局部序号），
       * value = { id, name, arguments（累计字符串）}
       */
      const activeToolCalls = new Map<
        number,
        { id: string; name: string; arguments: string }
      >()

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        if (!delta) continue

        // ── 文本增量 ──
        if (delta.content) {
          yield { type: "text_delta", content: delta.content }
        }

        // ── 工具调用增量 ──
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index

            if (tc.id) {
              // 第一次出现该 index：初始化记录并通知上层调用开始。
              activeToolCalls.set(idx, {
                id: tc.id,
                name: tc.function?.name ?? "",
                arguments: tc.function?.arguments ?? "",
              })
              yield {
                type: "tool_call_start",
                toolCall: {
                  id: tc.id,
                  type: "function",
                  function: { name: tc.function?.name ?? "", arguments: "" },
                },
              }
            } else {
              // 后续 chunk：追加 arguments 片段。
              const existing = activeToolCalls.get(idx)
              if (existing) {
                if (tc.function?.name) existing.name += tc.function.name
                if (tc.function?.arguments) existing.arguments += tc.function.arguments
              }
            }
          }
        }

        // ── 结束信号 ──
        const finishReason = chunk.choices[0]?.finish_reason
        if (finishReason) {
          // 所有工具调用参数已全部拼装完毕，逐个 yield tool_call_end。
          for (const [, tc] of activeToolCalls) {
            yield {
              type: "tool_call_end",
              toolCall: {
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: tc.arguments },
              },
            }
          }
          activeToolCalls.clear()
        }
      }

      yield { type: "done" }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      yield { type: "error", error: message }
    }
  }

  /** 将统一 Message 格式转换为 OpenAI SDK 接受的消息结构。 */
  private toOpenAIMessage(msg: Message): OpenAI.ChatCompletionMessageParam {
    switch (msg.role) {
      case "system":
        return { role: "system", content: msg.content ?? "" }
      case "user":
        return { role: "user", content: msg.content ?? "" }
      case "assistant":
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          // 携带 tool_calls 的 assistant 消息，content 可以为 null。
          return {
            role: "assistant",
            content: msg.content,
            tool_calls: msg.tool_calls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
          }
        }
        return { role: "assistant", content: msg.content ?? "" }
      case "tool":
        // 工具结果消息：必须携带 tool_call_id。
        return {
          role: "tool",
          content: msg.content ?? "",
          tool_call_id: msg.tool_call_id ?? "",
        }
    }
  }
}