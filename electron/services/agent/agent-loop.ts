import type { LLMProvider, Message, ToolCall } from './providers/base.provider'
import type ToolRegistry from './tools/tool-registry'

export interface AgentCallbacks {
  onTextDelta: (text: string) => void
  onTextReplace?: (fullText: string) => void
  onToolCallStart: (toolCall: { id: string; name: string }) => void
  onToolCallResult: (toolCall: { id: string; name: string; result: string }) => void
  onComplete: (fullResponse: string) => void
  onError: (error: string) => void
  /** Called for every assistant/tool message added during the loop, so they can be persisted for multi-turn context. */
  onMessageAdded?: (message: Message) => void
}

function buildSystemPrompt(workspacePath: string): string {
  return `You are an intelligent code editor assistant integrated into an IDE.
You have access to tools that let you interact with the user's workspace.

WORKSPACE ROOT: ${workspacePath}

IMPORTANT PATH RULES:
- All file paths in tool calls MUST be relative to the workspace root above.
- Use "." to refer to the workspace root itself.
- Example: to read "src/app.ts", pass path "src/app.ts" (NOT "/src/app.ts").
- NEVER use absolute paths or leading slashes.

Your capabilities:
- Read and write files in the workspace
- Search for text across files
- Run shell commands in the terminal
- List directory contents

Guidelines:
- Start by listing the workspace root to understand the project structure.
- Always read a file before attempting to edit it.
- When writing files, preserve existing formatting, indentation style, and conventions.
- Provide clear explanations of the changes you make and why.
- If a task is ambiguous, ask for clarification rather than guessing.
- When running commands, prefer safe and non-destructive operations.
- Think step-by-step for complex tasks: analyze the problem, plan your approach, then execute.
- If an error occurs, analyze it and attempt a reasonable fix before asking the user.`
}

export default class AgentLoop {
  private provider: LLMProvider
  private toolRegistry: ToolRegistry
  private aborted = false
  private readonly MAX_ITERATIONS = 20

  constructor(provider: LLMProvider, toolRegistry: ToolRegistry) {
    this.provider = provider
    this.toolRegistry = toolRegistry
  }

  async run(
    messages: Message[],
    callbacks: AgentCallbacks,
    workspacePath: string,
  ): Promise<void> {
    this.aborted = false

    const conversationMessages: Message[] = [
      { role: 'system', content: buildSystemPrompt(workspacePath) },
      ...messages,
    ]

    let iterations = 0
    let accumulatedText = ''

    try {
      while (iterations < this.MAX_ITERATIONS && !this.aborted) {
        iterations++

        const toolDefinitions = this.toolRegistry.getToolDefinitions()

        let fullText = ''
        const collectedToolCalls: ToolCall[] = []
        const toolCallBuilders = new Map<string, { id: string; name: string; arguments: string }>()

        const stream = this.provider.chat({
          messages: conversationMessages,
          tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
          stream: true,
        })

        for await (const chunk of stream) {
          if (this.aborted) break

          switch (chunk.type) {
            case 'text_delta':
              if (chunk.content) {
                fullText += chunk.content
                callbacks.onTextDelta(chunk.content)
              }
              break

            case 'tool_call_start':
              if (chunk.toolCall?.id) {
                const id = chunk.toolCall.id
                const name = chunk.toolCall.function?.name ?? ''
                toolCallBuilders.set(id, { id, name, arguments: chunk.toolCall.function?.arguments ?? '' })
                callbacks.onToolCallStart({ id, name })
              }
              break

            case 'tool_call_delta':
              if (chunk.toolCall?.id) {
                const builder = toolCallBuilders.get(chunk.toolCall.id)
                if (builder && chunk.toolCall.function?.arguments) {
                  builder.arguments += chunk.toolCall.function.arguments
                }
              }
              break

            case 'tool_call_end':
              if (chunk.toolCall?.id) {
                const builder = toolCallBuilders.get(chunk.toolCall.id)
                if (builder) {
                  collectedToolCalls.push({
                    id: builder.id,
                    type: 'function',
                    function: {
                      name: builder.name,
                      arguments: builder.arguments,
                    },
                  })
                }
              }
              break

            case 'error':
              callbacks.onError(chunk.error ?? 'Unknown streaming error')
              return

            case 'done':
              break
          }
        }

        if (this.aborted) {
          callbacks.onComplete(accumulatedText + fullText || 'Agent cancelled.')
          return
        }

        // --- Path A: API-based tool calls (model uses function calling) ---
        if (collectedToolCalls.length > 0) {
          console.log(`[AgentLoop] Iteration ${iterations}: ${collectedToolCalls.length} API tool call(s)`)
          accumulatedText += fullText

          const assistantMsg: Message = {
            role: 'assistant',
            content: fullText || null,
            tool_calls: collectedToolCalls,
          }
          conversationMessages.push(assistantMsg)
          callbacks.onMessageAdded?.(assistantMsg)

          for (const toolCall of collectedToolCalls) {
            const args = this.safeParseArgs(toolCall.function.arguments)

            const result = await this.toolRegistry.execute(
              toolCall.function.name,
              args,
              { workspacePath },
            )

            callbacks.onToolCallResult({
              id: toolCall.id,
              name: toolCall.function.name,
              result,
            })

            const toolMsg: Message = {
              role: 'tool',
              content: result,
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
            }
            conversationMessages.push(toolMsg)
            callbacks.onMessageAdded?.(toolMsg)
          }

          continue
        }

        // --- Path B: Fallback — parse tool calls embedded in text output ---
        if (fullText) {
          const parsedCalls = this.extractToolCallsFromText(fullText)

          if (parsedCalls.length > 0) {
            console.log(`[AgentLoop] Iteration ${iterations}: ${parsedCalls.length} text-parsed tool call(s): ${parsedCalls.map((c) => c.name).join(', ')}`)
            const cleanText = this.removeToolCallJsonFromText(fullText, parsedCalls)
            accumulatedText += cleanText

            callbacks.onTextReplace?.(accumulatedText)

            const fallbackToolCalls: ToolCall[] = parsedCalls.map((tc, i) => ({
              id: `textcall_${Date.now()}_${i}`,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            }))

            const assistantMsg: Message = {
              role: 'assistant',
              content: cleanText || null,
              tool_calls: fallbackToolCalls,
            }
            conversationMessages.push(assistantMsg)
            callbacks.onMessageAdded?.(assistantMsg)

            for (const toolCall of fallbackToolCalls) {
              callbacks.onToolCallStart({ id: toolCall.id, name: toolCall.function.name })

              const args = this.safeParseArgs(toolCall.function.arguments)

              const result = await this.toolRegistry.execute(
                toolCall.function.name,
                args,
                { workspacePath },
              )

              callbacks.onToolCallResult({
                id: toolCall.id,
                name: toolCall.function.name,
                result,
              })

              const toolMsg: Message = {
                role: 'tool',
                content: result,
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
              }
              conversationMessages.push(toolMsg)
              callbacks.onMessageAdded?.(toolMsg)
            }

            continue
          }
        }

        // --- Path C: Normal text-only completion ---
        console.log(`[AgentLoop] Iteration ${iterations}: Text-only response (${fullText.length} chars)`)
        accumulatedText += fullText
        callbacks.onComplete(accumulatedText)
        return
      }

      if (iterations >= this.MAX_ITERATIONS) {
        callbacks.onComplete(
          accumulatedText + '\n\n[Warning: Agent reached the maximum iteration limit and stopped.]',
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      callbacks.onError(message)
    }
  }

  cancel(): void {
    this.aborted = true
  }

  private safeParseArgs(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw)
    } catch {
      return { _raw: raw }
    }
  }

  /**
   * Scan text for JSON objects that match registered tool names.
   * Handles nested braces and string escaping properly.
   */
  private extractToolCallsFromText(
    text: string,
  ): { name: string; arguments: Record<string, unknown>; start: number; end: number }[] {
    const results: { name: string; arguments: Record<string, unknown>; start: number; end: number }[] = []
    const toolNames = new Set(this.toolRegistry.getAll().map((t) => t.name))

    let i = 0
    while (i < text.length) {
      if (text[i] === '{') {
        const end = this.findMatchingBrace(text, i)
        if (end > i) {
          const jsonStr = text.substring(i, end + 1)
          try {
            const obj = JSON.parse(jsonStr)
            if (obj.name && toolNames.has(obj.name)) {
              results.push({
                name: obj.name,
                arguments: obj.arguments ?? obj.parameters ?? {},
                start: i,
                end: end + 1,
              })
              i = end + 1
              continue
            }
          } catch {
            // not valid JSON
          }
        }
      }
      i++
    }

    return results
  }

  private findMatchingBrace(text: string, start: number): number {
    let depth = 0
    let inString = false
    let escapeNext = false

    for (let i = start; i < text.length; i++) {
      if (escapeNext) {
        escapeNext = false
        continue
      }

      const ch = text[i]

      if (ch === '\\' && inString) {
        escapeNext = true
        continue
      }

      if (ch === '"') {
        inString = !inString
        continue
      }

      if (inString) continue

      if (ch === '{') depth++
      else if (ch === '}') depth--

      if (depth === 0) return i
    }

    return -1
  }

  /**
   * Remove tool-call JSON (and surrounding code fences) from displayed text.
   */
  private removeToolCallJsonFromText(
    text: string,
    calls: { start: number; end: number }[],
  ): string {
    let result = text

    for (let i = calls.length - 1; i >= 0; i--) {
      let { start, end } = calls[i]

      const before = result.substring(0, start)
      const after = result.substring(end)

      const fenceStartMatch = before.match(/```(?:json)?\s*$/)
      const fenceEndMatch = after.match(/^\s*```/)

      if (fenceStartMatch) start -= fenceStartMatch[0].length
      if (fenceEndMatch) end += fenceEndMatch[0].length

      result = result.substring(0, start) + result.substring(end)
    }

    return result.replace(/\n{3,}/g, '\n\n').trim()
  }
}
