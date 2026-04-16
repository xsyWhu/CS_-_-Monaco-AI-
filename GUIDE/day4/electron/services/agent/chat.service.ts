/**
 * Day 4: Chat 服务——管理 Provider 配置与流式对话。
 *
 * 职责：
 * 1. 持久化保存/读取 Provider 配置（apiKey/baseURL/model）。
 * 2. 接收用户消息，调用 LLM Provider 流式生成，通过回调推送增量。
 *
 * 设计选择：
 * - Day 4 不引入多轮对话管理，仅做"单次请求→流式输出"，
 *   但内部维护消息历史以支持多轮上下文。
 * - 配置持久化到 Electron userData 目录，便于重启后恢复。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import type { LLMProvider, ChatMessage, ProviderConfig } from './providers/base.provider'
import OpenAIProvider from './providers/openai.provider'

// 流式输出时主进程 → 渲染进程的回调签名。
export interface ChatCallbacks {
  onToken: (token: string) => void
  onComplete: (fullText: string) => void
  onError: (error: string) => void
}

export default class ChatService {
  private provider: LLMProvider | null = null
  private providerConfig: ProviderConfig | null = null
  // 维护当前会话的消息列表，供多轮上下文使用。
  private messages: ChatMessage[] = []
  private settingsPath: string
  // 用于取消正在进行的流式请求。
  private abortController: AbortController | null = null

  constructor() {
    this.settingsPath = join(app.getPath('userData'), 'chat-settings.json')
    this.loadSettings()
  }

  /** 获取当前 Provider 配置，返回 null 表示未配置。 */
  getSettings(): ProviderConfig | null {
    return this.providerConfig
  }

  /** 更新 Provider 配置并重建 Provider 实例。 */
  updateSettings(config: ProviderConfig): void {
    this.providerConfig = config
    this.provider = new OpenAIProvider(config)
    this.saveSettings()
  }

  /** 清空当前会话消息（新建对话）。 */
  clearMessages(): void {
    this.messages = []
  }

  /** 发送消息并流式返回结果。 */
  async sendMessage(userContent: string, callbacks: ChatCallbacks): Promise<void> {
    if (!this.provider) {
      callbacks.onError('未配置 LLM Provider。请先在设置中填写 API Key 和模型名称。')
      return
    }

    // 将用户消息加入历史。
    this.messages.push({ role: 'user', content: userContent })

    let fullText = ''

    try {
      const stream = this.provider.chat({
        messages: this.messages,
        stream: true
      })

      for await (const chunk of stream) {
        if (chunk.type === 'text_delta' && chunk.content) {
          fullText += chunk.content
          callbacks.onToken(chunk.content)
        }

        if (chunk.type === 'error') {
          callbacks.onError(chunk.error ?? '未知错误。')
          return
        }
      }

      // 将助手回复加入历史，以供后续对话使用。
      this.messages.push({ role: 'assistant', content: fullText })
      callbacks.onComplete(fullText)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      callbacks.onError(message)
    }
  }

  /** 取消当前流式请求（Day 4 仅做标志位，后续可扩展）。 */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  // ─── 配置持久化 ────────────────────────────────────────

  private loadSettings(): void {
    try {
      if (existsSync(this.settingsPath)) {
        const raw = readFileSync(this.settingsPath, 'utf-8')
        const config: ProviderConfig = JSON.parse(raw)
        if (config.apiKey && config.baseURL && config.model) {
          this.providerConfig = config
          this.provider = new OpenAIProvider(config)
        }
      }
    } catch {
      // 文件不存在或格式错误，使用默认空配置。
    }
  }

  private saveSettings(): void {
    try {
      const dir = dirname(this.settingsPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(this.settingsPath, JSON.stringify(this.providerConfig, null, 2), 'utf-8')
    } catch {
      // 非关键操作，忽略写入失败。
    }
  }
}
