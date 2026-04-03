import { useEffect, useRef, useState } from 'react'
import { Plus, Settings, Loader2, Square } from 'lucide-react'
import { useChatStore } from '@/stores/chat.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useAgent } from '@/hooks/useAgent'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import SettingsDialog from '../settings/SettingsDialog'

export default function ChatPanel() {
  const messages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const newConversation = useChatStore((s) => s.newConversation)
  const provider = useSettingsStore((s) => s.provider)

  const { sendMessage, cancelStream } = useAgent()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-10 min-h-10 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider text-[var(--text-secondary)]">
            AI ASSISTANT
          </span>
          <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">
            {provider?.model || 'gpt-4o'}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={newConversation}
            className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="New conversation"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] select-none">
            <p className="text-sm">Start a conversation with the AI assistant</p>
            <p className="text-xs mt-1 opacity-60">Press Enter to send a message</p>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="flex items-center justify-center gap-2 py-1.5 text-xs text-[var(--text-muted)] border-t border-[var(--border)]/50">
          <Loader2 size={12} className="animate-spin text-[var(--accent)]" />
          <span>Generating...</span>
          <button
            onClick={cancelStream}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--error)] transition-colors"
          >
            <Square size={10} />
            Stop
          </button>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        isStreaming={isStreaming}
        onCancel={cancelStream}
      />

      <SettingsDialog isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
