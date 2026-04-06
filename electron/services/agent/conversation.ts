import { randomUUID } from 'crypto'
import type { Message } from './providers/base.provider'

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export default class ConversationManager {
  private conversations: Map<string, Conversation> = new Map()

  create(title?: string): Conversation {
    const conversation: Conversation = {
      id: randomUUID(),
      title: title ?? 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.conversations.set(conversation.id, conversation)
    return conversation
  }

  get(id: string): Conversation | undefined {
    return this.conversations.get(id)
  }

  getAll(): Conversation[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  addMessage(id: string, message: Message): void {
    const conversation = this.conversations.get(id)
    if (!conversation) {
      throw new Error(`Conversation "${id}" not found`)
    }
    conversation.messages.push(message)
    conversation.updatedAt = Date.now()
  }

  updateTitle(id: string, title: string): void {
    const conversation = this.conversations.get(id)
    if (!conversation) {
      throw new Error(`Conversation "${id}" not found`)
    }
    conversation.title = title
    conversation.updatedAt = Date.now()
  }

  delete(id: string): void {
    this.conversations.delete(id)
  }

  clear(): void {
    this.conversations.clear()
  }

  loadFromArray(conversations: Conversation[]): void {
    this.conversations.clear()
    conversations.forEach((conv) => {
      this.conversations.set(conv.id, conv)
    })
  }
}
