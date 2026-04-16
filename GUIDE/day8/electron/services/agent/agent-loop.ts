/**
 * Day 6: AgentLoop —— 自动化智能体主循环。
 *
 * 核心职责：
 *   while (未终止 && 迭代次数 < MAX) {
 *     调用 LLM（携带工具定义 + 历史消息）
 *     if 模型返回 tool_calls：
 *       执行每个工具，将结果追加进上下文
 *       continue  ← 让模型继续推理
 *     else（纯文本应答）：
 *       终止循环，通知外部 onComplete
 *   }
 *
 * 设计原则：
 * 1. AgentLoop 只负责「推理-执行-推理」循环，不持有任何 HTTP 状态或 UI 状态。
 * 2. 通过 AgentLoopCallbacks 向外部（ChatService → IPC → Renderer）推送事件。
 * 3. 支持 abort() 随时打断循环（用户点击「取消」时调用）。
 * 4. MAX_ITERATIONS 防御性上限：避免模型陷入无限工具调用死循环。
 */

import type { LLMProvider, Message, ToolCall } from "./providers/base.provider"
import type ToolRegistry from "./tools/tool-registry"

// ────────────────────────────────────────────────────────────────────────────
// 辅助函数：从文本中解析工具调用（Ollama 兼容回退）
// ────────────────────────────────────────────────────────────────────────────

/**
 * 查找与 startPos 处的 '{' 配对的 '}'，支持嵌套和字符串转义。
 */
function findMatchingBrace(text: string, start: number): number {
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    if (esc) { esc = false; continue }
    if (text[i] === "\\" && inStr) { esc = true; continue }
    if (text[i] === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (text[i] === "{") depth++
    else if (text[i] === "}") depth--
    if (depth === 0) return i
  }
  return -1
}

/**
 * 从模型输出的纯文本中解析 JSON 格式的工具调用。
 *
 * 某些本地模型（如 Ollama 的 qwen2.5-coder）有时会把工具调用以
 * `{"name":"tool_name","arguments":{...}}` 的形式输出到文本中，
 * 而非通过 API 的 Function Calling 机制。本函数对此做兼容解析。
 */
function parseToolCallsFromText(
  text: string,
  toolNames: Set<string>,
): { name: string; arguments: Record<string, unknown> }[] {
  const results: { name: string; arguments: Record<string, unknown> }[] = []
  let i = 0
  while (i < text.length) {
    if (text[i] === "{") {
      const end = findMatchingBrace(text, i)
      if (end > i) {
        try {
          const obj = JSON.parse(text.substring(i, end + 1))
          if (obj.name && toolNames.has(obj.name)) {
            results.push({
              name: obj.name,
              arguments: obj.arguments || obj.parameters || {},
            })
            i = end + 1
            continue
          }
        } catch {
          // 不是合法 JSON，跳过
        }
      }
    }
    i++
  }
  return results
}

// ────────────────────────────────────────────────────────────────────────────
// 类型定义
// ────────────────────────────────────────────────────────────────────────────

/**
 * AgentLoop 向外部推送的事件回调集合。
 *
 * 调用顺序（每次 run）：
 *   onThinking → [onToken* → onToolCallStart → onToolCallResult]* → onComplete | onError
 */
export interface AgentLoopCallbacks {
  /** 模型开始生成（本轮尚无文字输出时触发，表示"思考中"状态）。 */
  onThinking(): void
  /** 模型流式输出文字 token。 */
  onToken(token: string): void
  /** 工具即将被调用（参数 args 是最终 JSON 字符串）。 */
  onToolCallStart(info: { id: string; name: string; args: string }): void
  /** 工具执行完毕，返回结果。 */
  onToolCallResult(info: { id: string; name: string; result: string; isError: boolean }): void
  /** Agent 本次 run 正常结束。第二个参数为完整对话消息（含工具交互历史，不含系统提示词）。 */
  onComplete(fullText: string, conversationMessages?: Message[]): void
  /** Agent 发生错误（含超过最大迭代）。 */
  onError(error: string): void
  /** 当前迭代轮次发生变化（用于 UI 进度展示）。 */
  onIteration(current: number, max: number): void
  /** Day 8: 文件被工具修改时触发（供 Inline Diff 使用）。 */
  onFileChange?(info: { filePath: string; oldContent: string; newContent: string; toolName: string }): void
}

// ────────────────────────────────────────────────────────────────────────────
// 系统提示词
// ────────────────────────────────────────────────────────────────────────────

/**
 * 构建系统提示词。
 *
 * 好的系统提示词应当告诉模型：
 * - 它的「角色定位」（IDE 助手）
 * - 它拥有哪些「能力」（工具列表）
 * - 路径约定（避免路径歧义）
 * - 行为准则（先读后写、逐步推理）
 */
function buildSystemPrompt(workspacePath: string, customPrompt?: string): string {
  let prompt = `你是一个集成在代码编辑器中的 AI 编程助手，能够直接访问用户的工作区文件系统。

当前工作区根目录：${workspacePath}

== 工具使用规则 ==
- 所有工具调用中的文件路径均相对于上方工作区根目录（不要加 "/" 前缀）。
- 使用 "." 代表工作区根目录本身。
- 例：读取根目录下的 src/app.ts，传入 path 为 "src/app.ts"。

== 可用工具 ==
- list_files：列出目录结构，了解项目全貌时优先调用。
- read_file：读取文件内容（带行号），修改文件前必须先读取。
- search_files：在工作区中正则搜索文本，快速定位代码位置。
- write_file：将内容写入文件（覆盖写），如果文件不存在会自动创建。
- edit_file：精准替换文件中的指定文本片段（Patch 模式），适合小范围修改。
- run_command：在工作区目录下执行 Shell 命令，获取输出结果。

== 行为准则 ==
1. 收到复杂任务时，先 list_files 了解项目结构，再决定读哪些文件。
2. 修改文件前，必须先 read_file 读取最新内容，避免覆盖用户手动修改。
3. 小范围修改优先使用 edit_file（Patch），大范围重写使用 write_file。
4. 用自然语言解释你的每一步操作，帮助用户理解你的推理过程。
5. 如果不需要工具，直接给出文字回答即可，不要强行调用工具。`

  if (customPrompt?.trim()) {
    prompt += `\n\n== 用户自定义指令 ==\n${customPrompt.trim()}`
  }
  return prompt
}

// ────────────────────────────────────────────────────────────────────────────
// AgentLoop 类
// ────────────────────────────────────────────────────────────────────────────

export default class AgentLoop {
  /** abort() 被调用后置为 true，下一个循环检查点会退出。 */
  private aborted = false

  /** 最大自动迭代轮次（防止工具调用死循环）。 */
  readonly MAX_ITERATIONS: number

  /** 可选的自定义系统提示词追加内容。 */
  private customSystemPrompt?: string

  /** 模型 temperature（可选）。 */
  private temperature?: number

  constructor(
    private readonly provider: LLMProvider,
    private readonly toolRegistry: ToolRegistry,
    options?: { maxIterations?: number; systemPrompt?: string; temperature?: number },
  ) {
    this.MAX_ITERATIONS = options?.maxIterations ?? 10
    this.customSystemPrompt = options?.systemPrompt
    this.temperature = options?.temperature
  }

  /** 中断当前正在执行的 run()。幂等，可多次调用。 */
  abort(): void {
    this.aborted = true
  }

  /**
   * 执行 Agent 主循环。
   *
   * @param initialMessages 本次对话的历史消息（不含系统提示词，由本方法自动注入）
   * @param workspacePath   工作区根目录，用于构造系统提示词 & 工具执行上下文
   * @param callbacks       事件回调
   */
  async run(
    initialMessages: Message[],
    workspacePath: string,
    callbacks: AgentLoopCallbacks,
  ): Promise<void> {
    // 每次 run 重置中断标志，允许复用同一个 AgentLoop 实例。
    this.aborted = false

    // 构建本轮完整的消息上下文：系统提示词 + 传入的历史消息。
    const conversationMessages: Message[] = [
      { role: "system", content: buildSystemPrompt(workspacePath, this.customSystemPrompt) },
      ...initialMessages,
    ]

    // 跨轮次累积文本（最终传给 onComplete）。
    let fullText = ""

    for (let iteration = 0; iteration < this.MAX_ITERATIONS; iteration++) {
      // ── 中断检查点 ──────────────────────────────────────────────────────
      if (this.aborted) {
        callbacks.onComplete(fullText, conversationMessages.slice(1))
        return
      }

      // 通知前端当前轮次（UI 进度条 / 轮次显示）。
      callbacks.onIteration(iteration + 1, this.MAX_ITERATIONS)
      // 通知前端：模型进入推理阶段（尚无文字输出）。
      callbacks.onThinking()

      // ── 调用 LLM ────────────────────────────────────────────────────────
      const toolDefs = this.toolRegistry.getToolDefinitions()

      // 本轮模型产出的文本。
      let currentText = ""
      // 本轮中通过 tool_call_end 确认的完整工具调用列表。
      const completedToolCalls: ToolCall[] = []

      const stream = this.provider.chat({
        messages: conversationMessages,
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        stream: true,
        temperature: this.temperature,
      })

      // ── 消费流式 chunk ───────────────────────────────────────────────────
      for await (const chunk of stream) {
        if (this.aborted) break

        switch (chunk.type) {
          case "text_delta":
            if (chunk.content) {
              currentText += chunk.content
              fullText += chunk.content
              callbacks.onToken(chunk.content)
            }
            break

          case "tool_call_start":
            // tool_call_start 时参数尚在生成中，args 可能为空字符串。
            // 先通知前端「工具准备调用」（UI 可立即显示工具卡片）。
            if (chunk.toolCall?.id && chunk.toolCall.function?.name) {
              callbacks.onToolCallStart({
                id: chunk.toolCall.id,
                name: chunk.toolCall.function.name,
                args: chunk.toolCall.function.arguments ?? "",
              })
            }
            break

          case "tool_call_end":
            // tool_call_end 时 arguments 已完整，将其加入待执行列表。
            if (chunk.toolCall?.id && chunk.toolCall.function) {
              completedToolCalls.push({
                id: chunk.toolCall.id,
                type: "function",
                function: {
                  name: chunk.toolCall.function.name ?? "",
                  arguments: chunk.toolCall.function.arguments ?? "",
                },
              })
            }
            break

          case "error":
            callbacks.onError(chunk.error ?? "未知错误")
            return

          case "done":
            // 流正常结束，不需要额外处理。
            break
        }
      }

      // ── 中断后收尾 ───────────────────────────────────────────────────────
      if (this.aborted) {
        callbacks.onComplete(fullText, conversationMessages.slice(1))
        return
      }

      // ── Ollama 兼容回退：从文本中解析工具调用 ────────────────────────────
      // 某些本地模型不走 Function Calling 协议，而是把工具调用写成 JSON 文本。
      // 当 API 层没有检测到工具调用、但文本包含工具调用 JSON 时，进行回退解析。
      if (completedToolCalls.length === 0 && currentText.trim()) {
        const registeredNames = new Set(this.toolRegistry.getAll().map((t) => t.name))
        const textParsed = parseToolCallsFromText(currentText, registeredNames)
        if (textParsed.length > 0) {
          for (let i = 0; i < textParsed.length; i++) {
            const parsed = textParsed[i]
            const fakeId = `text_call_${Date.now()}_${i}`
            const argsStr = JSON.stringify(parsed.arguments)

            // 通知前端工具调用开始。
            callbacks.onToolCallStart({ id: fakeId, name: parsed.name, args: argsStr })

            completedToolCalls.push({
              id: fakeId,
              type: "function",
              function: { name: parsed.name, arguments: argsStr },
            })
          }
        }
      }

      // ── 判断循环继续 / 结束 ──────────────────────────────────────────────
      if (completedToolCalls.length === 0) {
        // 模型只返回文本，没有工具调用 → 对话自然结束。
        conversationMessages.push({ role: "assistant", content: currentText })
        callbacks.onComplete(fullText, conversationMessages.slice(1))
        return
      }

      // 有工具调用：先把「含 tool_calls 字段的 assistant 消息」追加进上下文。
      conversationMessages.push({
        role: "assistant",
        // 工具调用轮次可能同时有文字（如"让我帮你读取这个文件..."）。
        content: currentText || null,
        tool_calls: completedToolCalls,
      })

      // ── 依次执行工具 ─────────────────────────────────────────────────────
      for (const tc of completedToolCalls) {
        if (this.aborted) break

        // 解析模型生成的参数 JSON（模型有时输出格式不规范，需容错）。
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(tc.function.arguments)
        } catch {
          args = {}
        }

        // 执行工具（ToolRegistry 内部已做错误捕获，不会抛出）。
        const result = await this.toolRegistry.execute(
          tc.function.name,
          args,
          {
            workspacePath,
            // Day 8: 透传文件变更回调供 edit_file / write_file 使用。
            onFileChange: callbacks.onFileChange
              ? (info) => callbacks.onFileChange!(info)
              : undefined,
          },
        )

        // 判断是否为错误结果（工具 execute 返回的错误以 {"error" 开头）。
        const isError =
          result.startsWith('{"error"') ||
          result.includes('"error"') && result.startsWith("{")

        // 通知前端：工具执行完毕。
        callbacks.onToolCallResult({
          id: tc.id,
          name: tc.function.name,
          result,
          isError,
        })

        // 将工具结果追加进上下文，供模型下一轮推理使用。
        conversationMessages.push({
          role: "tool",
          content: result,
          tool_call_id: tc.id,
        })
      }
      // 循环继续 → 模型将基于新增的工具结果继续推理。
    }

    // 走到这里说明超出了最大迭代次数。
    callbacks.onError(
      `Agent 已达到最大迭代次数（${this.MAX_ITERATIONS} 轮）。请尝试将任务拆分为更小的步骤。`,
    )
  }
}
