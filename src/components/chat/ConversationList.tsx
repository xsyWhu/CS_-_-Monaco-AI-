import { Trash2, ChevronDown } from 'lucide-react'
import { useChatStore } from '@/stores/chat.store'
import { useState } from 'react'

interface ConversationListProps {
  isVisible: boolean
}

export default function ConversationList({ isVisible }: ConversationListProps) {
  const conversations = useChatStore((s) => s.conversations)
  const conversationId = useChatStore((s) => s.conversationId)
  const switchConversation = useChatStore((s) => s.switchConversation)
  const deleteConversation = useChatStore((s) => s.deleteConversation)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  if (!isVisible || conversations.length === 0) {
    return null
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (window.confirm('Delete this conversation?')) {
      await deleteConversation(id)
    }
  }

  return (
    <div className="flex flex-col gap-1 px-2 py-2 text-xs">
      <div className="flex items-center gap-1 px-2 py-1 text-[var(--text-muted)] font-semibold uppercase tracking-wider">
        <ChevronDown size={12} />
        <span>History</span>
      </div>
      <div className="space-y-0.5 max-h-48 overflow-y-auto">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onMouseEnter={() => setHoveredId(conv.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => switchConversation(conv.id)}
            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
              conversationId === conv.id
                ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs">{conv.title}</p>
              <p className="text-[10px] text-[var(--text-muted)] opacity-60">
                {formatDate(conv.updatedAt)}
              </p>
            </div>
            {hoveredId === conv.id && conversationId !== conv.id && (
              <button
                onClick={(e) => handleDelete(e, conv.id)}
                className="p-1 rounded hover:bg-[var(--error)]/20 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors shrink-0"
                title="Delete conversation"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
