/**
 * Day 7: ChatService -- Agent 配置与生命周期管理（薄层封装）。
 *
 * Day 7 新增：注册 edit_file（精准 Patch）和 run_command（Shell 执行）工具，
 * 使 Agent 共拥有 6 个工具能力：
 *   read_file / list_files / search / write_file / edit_file / run_command
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { app } from "electron"
import type { LLMProvider, ProviderConfig, Message } from "./providers/base.provider"
import OpenAIProvider from "./providers/openai.provider"
import ToolRegistry from "./tools/tool-registry"
import readFileTool from "./tools/read-file.tool"
import listFilesTool from "./tools/list-files.tool"
import searchFilesTool from "./tools/search.tool"
import writeFileTool from "./tools/write-file.tool"
import editFileTool from "./tools/edit-file.tool"
import runCommandTool from "./tools/run-command.tool"
import AgentLoop, { type AgentLoopCallbacks } from "./agent-loop"

export interface ChatCallbacks {
  onToken(token: string): void
  onThinking(): void
  onToolCallStart(info: { id: string; name: string; args: string }): void
  onToolCallResult(info: { id: string; name: string; result: string; isError: boolean }): void
  onComplete(fullText: string): void
  onError(error: string): void
  onIteration(current: number, max: number): void
}

export default class ChatService {
  private provider: LLMProvider | null = null
  private providerConfig: ProviderConfig | null = null
  private messages: Message[] = []
  private settingsPath: string
  private toolRegistry: ToolRegistry
  private currentLoop: AgentLoop | null = null

  constructor() {
    this.settingsPath = join(app.getPath("userData"), "chat-settings.json")
    this.loadSettings()
    this.toolRegistry = new ToolRegistry()
    // Day 6 基础工具（只读）
    this.toolRegistry.register(readFileTool)
    this.toolRegistry.register(listFilesTool)
    this.toolRegistry.register(searchFilesTool)
    this.toolRegistry.register(writeFileTool)
    // Day 7 高级工具（可修改 + 可执行）
    this.toolRegistry.register(editFileTool)
    this.toolRegistry.register(runCommandTool)
  }

  getSettings(): ProviderConfig | null { return this.providerConfig }

  updateSettings(config: ProviderConfig): void {
    this.providerConfig = config
    this.provider = new OpenAIProvider(config)
    this.saveSettings()
  }

  clearMessages(): void { this.messages = [] }

  abort(): void { this.currentLoop?.abort() }

  async sendMessage(userContent: string, workspacePath: string, callbacks: ChatCallbacks): Promise<void> {
    if (!this.provider) {
      callbacks.onError("未配置 LLM Provider。请先在设置中填写 API Key 和模型名称。")
      return
    }
    this.messages.push({ role: "user", content: userContent })
    this.currentLoop = new AgentLoop(this.provider, this.toolRegistry)
    const loopCallbacks: AgentLoopCallbacks = {
      onThinking: () => callbacks.onThinking(),
      onToken: (token) => callbacks.onToken(token),
      onToolCallStart: (info) => callbacks.onToolCallStart(info),
      onToolCallResult: (info) => callbacks.onToolCallResult(info),
      onIteration: (cur, max) => callbacks.onIteration(cur, max),
      onComplete: (fullText) => {
        if (fullText) this.messages.push({ role: "assistant", content: fullText })
        callbacks.onComplete(fullText)
        this.currentLoop = null
      },
      onError: (error) => {
        callbacks.onError(error)
        this.currentLoop = null
      },
    }
    await this.currentLoop.run([...this.messages], workspacePath, loopCallbacks)
  }

  private loadSettings(): void {
    try {
      if (existsSync(this.settingsPath)) {
        const config = JSON.parse(readFileSync(this.settingsPath, "utf-8")) as ProviderConfig
        this.providerConfig = config
        this.provider = new OpenAIProvider(config)
      }
    } catch { /* ignore */ }
  }

  private saveSettings(): void {
    if (!this.providerConfig) return
    try {
      const dir = dirname(this.settingsPath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(this.settingsPath, JSON.stringify(this.providerConfig, null, 2), "utf-8")
    } catch { /* ignore */ }
  }
}