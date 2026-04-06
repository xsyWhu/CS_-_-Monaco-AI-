import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import type { LLMProvider, Message, ProviderConfig } from './providers/base.provider'
import type { AgentCallbacks } from './agent-loop'
import AgentLoop from './agent-loop'
import ConversationManager from './conversation'
import type { Conversation } from './conversation'
import ToolRegistry from './tools/tool-registry'
import OpenAIProvider from './providers/openai.provider'
import readFileTool from './tools/read-file.tool'
import writeFileTool from './tools/write-file.tool'
import editFileTool from './tools/edit-file.tool'
import listFilesTool from './tools/list-files.tool'
import searchFilesTool from './tools/search.tool'
import runCommandTool from './tools/run-command.tool'

interface AgentSettings {
  provider: ProviderConfig | null
  workspacePath: string
}

const DEFAULT_SETTINGS: AgentSettings = {
  provider: null,
  workspacePath: '',
}

export default class AgentService {
  private toolRegistry: ToolRegistry
  private conversationManager: ConversationManager
  private providerConfig: ProviderConfig | null = null
  private currentProvider: LLMProvider | null = null
  private activeLoops: Map<string, AgentLoop> = new Map()
  private settingsPath: string
  private conversationsPath: string

  constructor() {
    this.toolRegistry = new ToolRegistry()
    this.conversationManager = new ConversationManager()
    this.settingsPath = path.join(app.getPath('userData'), 'agent-settings.json')
    this.conversationsPath = path.join(app.getPath('userData'), 'conversations.json')

    this.toolRegistry.register(readFileTool)
    this.toolRegistry.register(writeFileTool)
    this.toolRegistry.register(editFileTool)
    this.toolRegistry.register(listFilesTool)
    this.toolRegistry.register(searchFilesTool)
    this.toolRegistry.register(runCommandTool)

    this.loadSettings()
    this.loadConversations()
  }

  getSettings(): AgentSettings {
    return {
      provider: this.providerConfig,
      workspacePath: DEFAULT_SETTINGS.workspacePath,
    }
  }

  updateSettings(settings: Partial<AgentSettings>): void {
    if (settings.provider !== undefined) {
      this.providerConfig = settings.provider
      this.currentProvider = this.providerConfig
        ? this.createProvider(this.providerConfig)
        : null
    }
    if (settings.workspacePath !== undefined) {
      DEFAULT_SETTINGS.workspacePath = settings.workspacePath
    }
    this.saveSettings({
      provider: this.providerConfig,
      workspacePath: DEFAULT_SETTINGS.workspacePath,
    })
  }

  /**
   * Synchronously create or find a conversation and add the user message.
   * Returns the conversation ID immediately so the IPC handler can return it
   * without waiting for the agent loop to finish.
   */
  prepareConversation(
    message: string,
    conversationId: string | undefined,
  ): { id: string; error?: string } {
    if (!this.currentProvider) {
      return {
        id: conversationId ?? '',
        error: 'No LLM provider configured. Please open Settings and configure your API endpoint first.',
      }
    }

    let conversation: Conversation
    if (conversationId) {
      const existing = this.conversationManager.get(conversationId)
      if (!existing) {
        return { id: conversationId, error: `Conversation "${conversationId}" not found` }
      }
      conversation = existing
    } else {
      const title = message.length > 50 ? message.substring(0, 50) + '...' : message
      conversation = this.conversationManager.create(title)
    }

    const userMessage: Message = { role: 'user', content: message }
    this.conversationManager.addMessage(conversation.id, userMessage)

    return { id: conversation.id }
  }

  /**
   * Runs the agent loop asynchronously for an already-prepared conversation.
   * Callers should NOT await this if they want the IPC handler to return immediately.
   */
  async runConversation(
    conversationId: string,
    callbacks: AgentCallbacks,
    workspacePath?: string,
  ): Promise<void> {
    if (!this.currentProvider) {
      callbacks.onError('No LLM provider configured.')
      return
    }

    const conversation = this.conversationManager.get(conversationId)
    if (!conversation) {
      callbacks.onError(`Conversation "${conversationId}" not found`)
      return
    }

    const loop = new AgentLoop(this.currentProvider, this.toolRegistry)
    this.activeLoops.set(conversationId, loop)

    const resolvedWorkspace = workspacePath || DEFAULT_SETTINGS.workspacePath || process.cwd()

    let intermediateMessagesSaved = false

    const wrappedCallbacks: AgentCallbacks = {
      onTextDelta: callbacks.onTextDelta,
      onTextReplace: callbacks.onTextReplace,
      onToolCallStart: callbacks.onToolCallStart,
      onToolCallResult: callbacks.onToolCallResult,
      onMessageAdded: (message: Message) => {
        this.conversationManager.addMessage(conversationId, message)
        intermediateMessagesSaved = true
      },
      onComplete: (fullResponse: string) => {
        if (!intermediateMessagesSaved) {
          this.conversationManager.addMessage(conversationId, {
            role: 'assistant',
            content: fullResponse,
          })
        } else {
          this.conversationManager.addMessage(conversationId, {
            role: 'assistant',
            content: fullResponse,
          })
        }
        this.activeLoops.delete(conversationId)
        this.saveConversations()
        callbacks.onComplete(fullResponse)
      },
      onError: (error: string) => {
        this.activeLoops.delete(conversationId)
        this.saveConversations()
        callbacks.onError(error)
      },
    }

    await loop.run(conversation.messages, wrappedCallbacks, resolvedWorkspace)
  }

  cancel(conversationId: string): void {
    const loop = this.activeLoops.get(conversationId)
    if (loop) {
      loop.cancel()
      this.activeLoops.delete(conversationId)
    }
  }

  getConversations(): Conversation[] {
    return this.conversationManager.getAll()
  }

  getConversation(id: string): Conversation | undefined {
    return this.conversationManager.get(id)
  }

  deleteConversation(id: string): void {
    this.cancel(id)
    this.conversationManager.delete(id)
    this.saveConversations()
  }

  clearConversations(): void {
    for (const [id] of this.activeLoops) {
      this.cancel(id)
    }
    this.conversationManager.clear()
    this.saveConversations()
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry
  }

  private loadConversations(): void {
    try {
      if (fs.existsSync(this.conversationsPath)) {
        const raw = fs.readFileSync(this.conversationsPath, 'utf-8')
        const conversations: Conversation[] = JSON.parse(raw)
        this.conversationManager.loadFromArray(conversations)
        console.log(`[Agent] Loaded ${conversations.length} conversations from disk`)
      }
    } catch (error) {
      console.error('[Agent] Failed to load conversations:', error)
    }
  }

  private saveConversations(): void {
    try {
      // Only save conversations that have messages (not empty conversations)
      const conversations = this.conversationManager.getAll()
      const conversationsWithMessages = conversations.filter((conv) => conv.messages.length > 0)
      
      const dir = path.dirname(this.conversationsPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(
        this.conversationsPath,
        JSON.stringify(conversationsWithMessages, null, 2),
        'utf-8',
      )
    } catch (error) {
      console.error('[Agent] Failed to save conversations:', error)
    }
  }

  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const raw = fs.readFileSync(this.settingsPath, 'utf-8')
        const settings: AgentSettings = JSON.parse(raw)

        if (settings.provider) {
          this.providerConfig = settings.provider
          this.currentProvider = this.createProvider(settings.provider)
        }
        if (settings.workspacePath) {
          DEFAULT_SETTINGS.workspacePath = settings.workspacePath
        }
      }
    } catch {
      // Settings file doesn't exist or is invalid — use defaults
    }
  }

  private saveSettings(settings: AgentSettings): void {
    try {
      const dir = path.dirname(this.settingsPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
    } catch {
      // Non-critical: settings save failure is tolerable
    }
  }

  private createProvider(config: ProviderConfig): LLMProvider {
    return new OpenAIProvider(config)
  }
}
