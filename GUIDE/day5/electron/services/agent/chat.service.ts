/**
 * Day 5: Chat 服务——带工具调用的 Agent Loop。
 *
 * 相较 Day 4 的主要变化：
 * 1. 将 ChatMessage 换成支持 tool role 的 Message 类型。
 * 2. 初始化 ToolRegistry，注册三个只读工具。
 * 3. sendMessage 升级为 Agent Loop：
 *    - 每轮携带 tools 参数调用 Provider。
 *    - 如果模型返回 tool_call → 执行工具 → 把结果拼回消息 → 再次调用模型。
 *    - 如果模型只返回文本 → 本轮终止，通知前端 onComplete。
 * 4. 新增 onToolCall / onToolResult 回调，前端据此展示工具调用块。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { app } from "electron"
import type { LLMProvider, ProviderConfig, Message, ToolCall } from "./providers/base.provider"
import OpenAIProvider from "./providers/openai.provider"
import ToolRegistry from "./tools/tool-registry"
import readFileTool from "./tools/read-file.tool"
import listFilesTool from "./tools/list-files.tool"
import searchFilesTool from "./tools/search.tool"

/** 流式输出回调集合。 */
export interface ChatCallbacks {
  onToken: (token: string) => void
  onComplete: (fullText: string) => void
  onError: (error: string) => void
  // Day 5 新增：工具调用生命周期回调。
  onToolCall: (info: { id: string; name: string; args: string }) => void
  onToolResult: (info: { id: string; result: string; isError: boolean }) => void
}

/** Agent Loop 的最大迭代次数，防止无限循环。 */
const MAX_ITERATIONS = 10

export default class ChatService {
  private provider: LLMProvider | null = null
  private providerConfig: ProviderConfig | null = null
  /** 当前会话的多轮对话历史。 */
  private messages: Message[] = []
  private settingsPath: string
  /** 工具注册中心（在构造时一次性初始化，无需每次请求重建）。 */
  private toolRegistry: ToolRegistry

  constructor() {
    this.settingsPath = join(app.getPath("userData"), "chat-settings.json")
    this.loadSettings()

    // 注册三个只读工具：模型通过 Function Calling 自主选择调用。
    this.toolRegistry = new ToolRegistry()
    this.toolRegistry.register(readFileTool)
    this.toolRegistry.register(listFilesTool)
    this.toolRegistry.register(searchFilesTool)
  }

  getSettings(): ProviderConfig | null {
    return this.providerConfig
  }

  updateSettings(config: ProviderConfig): void {
    this.providerConfig = config
    this.provider = new OpenAIProvider(config)
    this.saveSettings()
  }

  clearMessages(): void {
    this.messages = []
  }

  /**
   * 核心 Agent Loop。
   *
   * 伪代码：
   *   while (iterations < MAX) {
   *     response = provider.chat(messages, tools)
   *     if response has tool_calls:
   *       execute each tool, append results to messages
   *       continue
   *     else:
   *       done
   *   }
   *
   * @param userContent 本次用户输入文本
   * @param workspacePath 工作区根路径（供工具使用）
   * @param callbacks 流式回调
   */
  async sendMessage(
    userContent: string,
    workspacePath: string,
    callbacks: ChatCallbacks,
  ): Promise<void> {
    if (!this.provider) {
      callbacks.onError("未配置 LLM Provider。请先在设置中填写 API Key 和模型名称。")
      return
    }

    // 将用户消息加入历史。
    this.messages.push({ role: "user", content: userContent })

    const toolContext = { workspacePath }
    const toolDefs = this.toolRegistry.getToolDefinitions()
    let accumulatedText = ""

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      let currentRoundText = ""
      // 本轮收集到的完整 tool_call 列表（等 tool_call_end 才确认）。
      const completedToolCalls: ToolCall[] = []

      const stream = this.provider.chat({
        messages: this.messages,
        tools: toolDefs,
        stream: true,
      })

      for await (const chunk of stream) {
        switch (chunk.type) {
          case "text_delta":
            if (chunk.content) {
              currentRoundText += chunk.content
              accumulatedText += chunk.content
              callbacks.onToken(chunk.content)
            }
            break

          case "tool_call_start":
            // 通知前端：某个工具即将被调用（名称已知，参数还在生成中）。
            if (chunk.toolCall?.id && chunk.toolCall?.function?.name) {
              callbacks.onToolCall({
                id: chunk.toolCall.id,
                name: chunk.toolCall.function.name,
                args: "",
              })
            }
            break

          case "tool_call_end":
            // 工具调用参数生成完毕，加入待执行列表。
            if (
              chunk.toolCall?.id &&
              chunk.toolCall?.function?.name !== undefined &&
              chunk.toolCall?.function?.arguments !== undefined
            ) {
              const tc: ToolCall = {
                id: chunk.toolCall.id,
                type: "function",
                function: {
                  name: chunk.toolCall.function.name,
                  arguments: chunk.toolCall.function.arguments,
                },
              }
              completedToolCalls.push(tc)
            }
            break

          case "error":
            callbacks.onError(chunk.error ?? "未知错误")
            return

          case "done":
            break
        }
      }

      // ── 本轮无工具调用：对话结束 ──
      if (completedToolCalls.length === 0) {
        // 将助手的文本回复记入历史，供后续多轮上下文使用。
        this.messages.push({ role: "assistant", content: currentRoundText })
        callbacks.onComplete(accumulatedText)
        return
      }

      // ── 本轮有工具调用：执行工具并拼回历史 ──

      // 1. 将 assistant 的 tool_call 决定加入历史（content 可以为 null）。
      this.messages.push({
        role: "assistant",
        content: currentRoundText || null,
        tool_calls: completedToolCalls,
      })

      // 2. 依次执行每个工具，把结果作为 tool 消息追加。
      for (const tc of completedToolCalls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(tc.function.arguments)
        } catch {
          // 参数解析失败时传空对象，工具内部会报错。
        }

        const result = await this.toolRegistry.execute(tc.function.name, args, toolContext)

        // 通知前端：工具执行完毕，展示结果。
        const isError = result.startsWith('{"error"')
        callbacks.onToolResult({ id: tc.id, result, isError })

        // 工具结果消息必须携带 tool_call_id 以与调用对应。
        this.messages.push({
          role: "tool",
          content: result,
          tool_call_id: tc.id,
        })
      }

      // 进入下一轮，让模型基于工具结果继续推理。
    }

    // 超出最大迭代次数。
    callbacks.onError(`Agent 超出最大迭代次数 (${MAX_ITERATIONS})，请简化任务或重新发起对话。`)
  }

  private loadSettings(): void {
    try {
      if (existsSync(this.settingsPath)) {
        const raw = readFileSync(this.settingsPath, "utf-8")
        this.providerConfig = JSON.parse(raw) as ProviderConfig
        this.provider = new OpenAIProvider(this.providerConfig)
      }
    } catch {
      // 文件损坏时忽略，等待用户重新配置。
    }
  }

  private saveSettings(): void {
    if (!this.providerConfig) return
    const dir = dirname(this.settingsPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(this.settingsPath, JSON.stringify(this.providerConfig, null, 2), "utf-8")
  }
}