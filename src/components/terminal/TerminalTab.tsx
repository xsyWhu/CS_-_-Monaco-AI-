import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useTerminalStore } from '../../stores/terminal.store'

interface TerminalTabProps {
  terminal: { id: string; title: string }
  isActive: boolean
}

export default function TerminalTab({ terminal, isActive }: TerminalTabProps) {
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal)
  const closeTerminal = useTerminalStore((s) => s.closeTerminal)

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer border-b-2 shrink-0 select-none group',
        isActive
          ? 'text-[var(--text-primary)] border-[var(--accent)] bg-[var(--bg-primary)]'
          : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
      )}
      onClick={() => setActiveTerminal(terminal.id)}
    >
      <span className="truncate max-w-[120px]">{terminal.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          closeTerminal(terminal.id)
        }}
        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
      >
        <X size={12} />
      </button>
    </div>
  )
}
