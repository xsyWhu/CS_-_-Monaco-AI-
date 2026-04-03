import { Plus, X } from 'lucide-react'
import { useTerminalStore } from '../../stores/terminal.store'
import TerminalTab from './TerminalTab'
import TerminalInstance from './TerminalInstance'

export default function TerminalPanel() {
  const terminals = useTerminalStore((s) => s.terminals)
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId)
  const createTerminal = useTerminalStore((s) => s.createTerminal)
  const closeTerminal = useTerminalStore((s) => s.closeTerminal)

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--border)] shrink-0">
        <span className="text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
          Terminal
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => createTerminal()}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="New Terminal"
          >
            <Plus size={14} />
          </button>
          {activeTerminalId && (
            <button
              onClick={() => closeTerminal(activeTerminalId)}
              className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="Close Terminal"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {terminals.length > 1 && (
        <div className="flex items-center border-b border-[var(--border)] overflow-x-auto shrink-0">
          {terminals.map((t) => (
            <TerminalTab
              key={t.id}
              terminal={t}
              isActive={t.id === activeTerminalId}
            />
          ))}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {terminals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-[var(--text-muted)] text-xs">No terminals open</p>
            <button
              onClick={() => createTerminal()}
              className="px-4 py-1.5 rounded text-xs bg-[var(--accent)] text-[var(--bg-primary)] font-medium hover:opacity-90 transition-opacity"
            >
              Create Terminal
            </button>
          </div>
        ) : (
          activeTerminalId && (
            <TerminalInstance key={activeTerminalId} terminalId={activeTerminalId} />
          )
        )}
      </div>
    </div>
  )
}
