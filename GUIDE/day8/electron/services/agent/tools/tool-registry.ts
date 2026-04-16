/**
 * Day 5: 工具注册中心（Tool Registry）。
 *
 * 职责：
 * 1. 统一管理所有可被 LLM 调用的工具。
 * 2. 将工具元数据（名称/描述/参数 JSON Schema）暴露给 Provider，
 *    Provider 再将其包装成 OpenAI 的 tools 字段传给 API。
 * 3. 在模型返回 tool_call 后，通过名称路由到具体实现执行。
 *
 * 设计原则：
 * - 注册中心只维护索引，不关心工具的具体实现。
 * - JSON Schema 描述工具参数（type/properties/required），
 *   这是 OpenAI Function Calling 的核心契约。
 */

import type { ToolDefinition } from '../providers/base.provider'

/** 工具执行上下文：提供工具所需的环境信息。 */
export interface ToolContext {
  workspacePath: string
  /** Day 8: 文件变更通知回调（edit_file/write_file 修改文件后调用）。 */
  onFileChange?: (info: {
    filePath: string
    oldContent: string
    newContent: string
    toolName: string
  }) => void
}

/** 每个工具必须实现的接口。 */
export interface AgentTool {
  /** 工具名称（必须唯一，且与模型调用时使用的名称一致）。 */
  name: string
  /** 工具描述：模型阅读这段文字来理解何时选择此工具。 */
  description: string
  /**
   * 工具参数的 JSON Schema 定义。
   * OpenAI 规范要求格式为：
   *   { type: 'object', properties: { ... }, required: [...] }
   * 模型据此知道如何填写参数，调用时返回结构化 JSON。
   */
  parameters: Record<string, unknown>
  /** 工具执行函数：接收模型填写的参数，返回字符串结果。 */
  execute(args: Record<string, unknown>, context: ToolContext): Promise<string>
}

export default class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map()

  /** 注册一个工具。 */
  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool)
  }

  /** 按名称查找工具。 */
  get(name: string): AgentTool | undefined {
    return this.tools.get(name)
  }

  /** 获取所有已注册工具。 */
  getAll(): AgentTool[] {
    return Array.from(this.tools.values())
  }

  /**
   * 将所有工具描述转换为 OpenAI tools 字段格式。
   * 这是 Function Calling 的关键一步：告诉模型"你有哪些工具"。
   */
  getToolDefinitions(): ToolDefinition[] {
    return this.getAll().map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))
  }

  /**
   * 根据名称执行工具并返回结果字符串。
   * 工具执行失败时返回 JSON 错误描述，不抛异常，
   * 让模型仍能感知失败原因并调整策略。
   */
  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<string> {
    const tool = this.tools.get(name)
    if (!tool) {
      return JSON.stringify({ error: `工具 "${name}" 未注册` })
    }

    try {
      return await tool.execute(args, context)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return JSON.stringify({ error: `工具 "${name}" 执行失败: ${message}` })
    }
  }
}
