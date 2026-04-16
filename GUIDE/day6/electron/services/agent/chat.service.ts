/**
 * Day 6: ChatService -- Agent 配置与生命周期管理（薄层封装）。
 *
 * Day 5 vs Day 6：
 *   Day 5 的 sendMessage() 中直接嵌入了整个 Agent Loop for 循环（~80 行）。
 *   Day 6 将循环抽取到独立的 AgentLoop 类；ChatService 只负责：
 *     - 读写 LLM 配置（API Key / baseURL / model）
 *     - 维护多轮对话历史（messages[]）
 *     - 持有并转发 AgentLoop 的 abort() 信号
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
    this.toolRegistry.register(readFileTool)
    this.toolRegistry.register(listFilesTool)
    this.toolRegistry.register(searchFilesTool)
    this.toolRegistry.register(writeFileTool)
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