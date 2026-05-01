import { FileCode2, Heading1, LibraryBig, SquareCode } from 'lucide-react'
import { useEditorStore } from '@/stores/editor.store'
import type { OutlineItem } from '@/types/editor.types'

function kindIcon(kind: string) {
  switch (kind) {
    case 'heading':
      return <Heading1 size={12} />
    case 'class':
    case 'interface':
    case 'enum':
    case 'namespace':
      return <LibraryBig size={12} />
    case 'function':
    case 'method':
    case 'constructor':
      return <SquareCode size={12} />
    default:
      return <FileCode2 size={12} />
  }
}

function OutlineRow({
  item,
  onJump,
}: {
  item: OutlineItem
  onJump: (line: number, column: number) => void
}) {
  const paddingLeft = 12 + item.depth * 14

  return (
    <div>
      <button
        onClick={() => onJump(item.line, item.column)}
        className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-hover)] transition-colors"
        style={{ paddingLeft }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[var(--text-muted)] shrink-0">{kindIcon(item.kind)}</span>
          <span className="text-sm text-[var(--text-primary)] truncate">{item.name}</span>
        </div>
        <div className="ml-4 text-[10px] text-[var(--text-muted)]">
          {item.kind} · {item.line}:{item.column}
        </div>
      </button>

      {item.children?.length ? (
        <div>
          {item.children.map((child) => (
            <OutlineRow key={child.id} item={child} onJump={onJump} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function OutlinePanel() {
  const outlineItems = useEditorStore((s) => s.outlineItems)
  const activeTab = useEditorStore((s) => s.tabs.find((tab) => tab.id === s.activeTabId) ?? null)
  const openFileAtPosition = useEditorStore((s) => s.openFileAtPosition)

  const handleJump = (line: number, column: number) => {
    if (!activeTab) return
    void openFileAtPosition(activeTab.filePath, line, column)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      <div className="px-4 py-2 text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase border-b border-[var(--border)] shrink-0 flex items-center justify-between">
        <span>Outline</span>
        <span className="text-[10px] normal-case text-[var(--text-muted)]">
          {outlineItems.length} items
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!activeTab ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
            Open a file to view its structure
          </div>
        ) : outlineItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)] px-4 text-center">
            No outline available for this file
          </div>
        ) : (
          <div className="py-1">
            {outlineItems.map((item) => (
              <OutlineRow key={item.id} item={item} onJump={handleJump} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
