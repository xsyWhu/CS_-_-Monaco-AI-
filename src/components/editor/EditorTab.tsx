import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Pin, PinOff, RotateCcw, SplitSquareHorizontal, X } from 'lucide-react'
import { useEditorStore } from '@/stores/editor.store'
import { cn } from '@/lib/utils'
import type { FileTab } from '@/types/editor.types'
import type { EditorPane } from '@/stores/editor.store'

interface EditorTabProps {
  tab: FileTab
  isActive: boolean
  pane: EditorPane
}

export default function EditorTab({ tab, isActive, pane }: EditorTabProps) {
  const setActiveTab = useEditorStore((s) => s.setActiveTab)
  const closeTab = useEditorStore((s) => s.closeTab)
  const closeOtherTabs = useEditorStore((s) => s.closeOtherTabs)
  const closeTabsToRight = useEditorStore((s) => s.closeTabsToRight)
  const reopenClosedTab = useEditorStore((s) => s.reopenClosedTab)
  const togglePinTab = useEditorStore((s) => s.togglePinTab)
  const moveTabToPane = useEditorStore((s) => s.moveTabToPane)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuState, setMenuState] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuState(null)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <>
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
        onContextMenu={(e) => {
          e.preventDefault()
          setMenuState({ x: e.clientX, y: e.clientY })
        }}
        className={cn(
          'group flex items-center gap-1.5 h-[34px] px-3 text-xs cursor-pointer border-r border-[var(--border)] shrink-0 transition-colors',
          isActive
            ? 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
            : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]',
          tab.isPinned && 'pl-2.5',
        )}
      >
        <span className="truncate max-w-[120px]">{tab.fileName}</span>

        {tab.isPinned && <Pin size={10} className="text-[var(--accent)] shrink-0" />}

        <div className="flex items-center justify-center w-4 h-4 shrink-0">
          {tab.isDirty ? (
            <span className="w-2 h-2 rounded-full bg-[var(--text-secondary)] group-hover:hidden" />
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
              tab.isDirty ? 'hidden group-hover:flex' : 'hidden group-hover:flex',
            )}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {menuState && (
        <div
          ref={menuRef}
          className="fixed z-[120] min-w-[200px] rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] shadow-2xl py-1"
          style={{ left: menuState.x, top: menuState.y }}
        >
          <TabMenuItem
            icon={tab.isPinned ? PinOff : Pin}
            label={tab.isPinned ? 'Unpin Tab' : 'Pin Tab'}
            onClick={() => {
              togglePinTab(tab.id)
              setMenuState(null)
            }}
          />
          <TabMenuItem
            icon={SplitSquareHorizontal}
            label={`Open to ${pane === 'left' ? 'Right' : 'Left'}`}
            onClick={() => {
              moveTabToPane(tab.id, pane === 'left' ? 'right' : 'left')
              setMenuState(null)
            }}
          />
          <TabMenuItem
            icon={X}
            label="Close Tab"
            onClick={() => {
              void closeTab(tab.id)
              setMenuState(null)
            }}
          />
          <TabMenuItem
            icon={X}
            label="Close Others"
            onClick={() => {
              void closeOtherTabs(tab.id, pane)
              setMenuState(null)
            }}
          />
          <TabMenuItem
            icon={X}
            label="Close to the Right"
            onClick={() => {
              void closeTabsToRight(tab.id, pane)
              setMenuState(null)
            }}
          />
          <div className="my-1 border-t border-[var(--border)]" />
          <TabMenuItem
            icon={RotateCcw}
            label="Reopen Closed Tab"
            onClick={() => {
              void reopenClosedTab()
              setMenuState(null)
            }}
          />
        </div>
      )}
    </>
  )
}

function TabMenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ size?: number; className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
    >
      <Icon size={14} className="text-[var(--text-muted)]" />
      <span>{label}</span>
    </button>
  )
}
