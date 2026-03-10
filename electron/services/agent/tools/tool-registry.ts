import type { ToolDefinition } from '../providers/base.provider'

export interface ToolContext {
  workspacePath: string
}

export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute(args: Record<string, unknown>, context: ToolContext): Promise<string>
}

export default class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map()

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name)
  }

  getAll(): AgentTool[] {
    return Array.from(this.tools.values())
  }

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

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<string> {
    const tool = this.tools.get(name)
    if (!tool) {
      return JSON.stringify({ error: `Tool "${name}" not found` })
    }

    try {
      return await tool.execute(args, context)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return JSON.stringify({ error: `Tool "${name}" failed: ${message}` })
    }
  }
}
