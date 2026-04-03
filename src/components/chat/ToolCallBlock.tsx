import { useState } from 'react'
import { Wrench, ChevronRight, ChevronDown, Loader2, Check, X } from 'lucide-react'
import type { ToolCallInfo } from '@/types/agent.types'

interface Props {
  toolCall: ToolCallInfo
}

const statusMap: Record<
  ToolCallInfo['status'],
  { color: string; Icon: typeof Check | null; spin?: boolean }
> = {
  pending: { color: 'text-[var(--text-muted)]', Icon: null },
  running: { color: 'text-[var(--accent)]', Icon: Loader2, spin: true },
  completed: { color: 'text-[var(--success)]', Icon: Check },
  error: { color: 'text-[var(--error)]', Icon: X },
}

export default function ToolCallBlock({ toolCall }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { color, Icon, spin } = statusMap[toolCall.status]

  let formattedArgs = toolCall.arguments ?? ''
  try {
    if (formattedArgs) {
      formattedArgs = JSON.stringify(JSON.parse(formattedArgs), null, 2)
    }
  } catch {
    // keep raw string on parse failure
  }

  return (
    <div className="rounded-md border border-[var(--border)] overflow-hidden text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown size={12} className="text-[var(--text-muted)] flex-shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-[var(--text-muted)] flex-shrink-0" />
        )}
        <Wrench size={12} className="text-[var(--text-muted)] flex-shrink-0" />
        <span className="font-medium text-[var(--text-primary)] truncate">{toolCall.name}</span>
        <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          {Icon && <Icon size={12} className={`${color} ${spin ? 'animate-spin' : ''}`} />}
          <span className={color}>{toolCall.status}</span>
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-primary)]">
          {formattedArgs && (
            <div className="px-3 py-2">
              <p className="text-[var(--text-muted)] mb-1 text-[10px] uppercase tracking-wider">
                Arguments
              </p>
              <pre className="bg-[var(--bg-secondary)] rounded p-2 overflow-x-auto text-[var(--text-secondary)] whitespace-pre-wrap break-all">
                {formattedArgs}
              </pre>
            </div>
          )}
          {toolCall.result != null && (
            <div className="px-3 py-2 border-t border-[var(--border)]">
              <p className="text-[var(--text-muted)] mb-1 text-[10px] uppercase tracking-wider">
                Result
              </p>
              <pre className="bg-[var(--bg-secondary)] rounded p-2 overflow-x-auto text-[var(--text-secondary)] whitespace-pre-wrap break-all max-h-[300px]">
                {toolCall.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
