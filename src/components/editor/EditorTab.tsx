import { X } from 'lucide-react'
import { useEditorStore } from '@/stores/editor.store'
import { cn } from '@/lib/utils'
import type { FileTab } from '@/types/editor.types'

interface EditorTabProps {
  tab: FileTab
  isActive: boolean
}

export default function EditorTab({ tab, isActive }: EditorTabProps) {
  const setActiveTab = useEditorStore((s) => s.setActiveTab)
  const closeTab = useEditorStore((s) => s.closeTab)

  return (
    <div
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(tab.id)}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault()
          void closeTab(tab.id)
        }
      }}
      className={cn(
        'group flex items-center gap-1.5 h-[34px] px-3 text-xs cursor-pointer border-r border-[var(--border)] shrink-0 transition-colors',
        isActive
          ? 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
          : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
      )}
    >
      <span className="truncate max-w-[120px]">{tab.fileName}</span>

      {/* Dirty indicator or close button */}
      <div className="flex items-center justify-center w-4 h-4 shrink-0">
        {tab.isDirty ? (
          <span
            className="w-2 h-2 rounded-full bg-[var(--text-secondary)] group-hover:hidden"
          />
        ) : (
          <span className="w-2 h-2 hidden" />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            void closeTab(tab.id)
          }}
          className={cn(
            'items-center justify-center w-4 h-4 rounded-sm hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors',
            tab.isDirty ? 'hidden group-hover:flex' : 'hidden group-hover:flex'
          )}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
