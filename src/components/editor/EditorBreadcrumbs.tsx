import { ChevronRight, FolderOpen, Search, Wand2, SquarePen } from 'lucide-react'
import { useMemo } from 'react'
import { useEditorStore } from '@/stores/editor.store'
import { useFileTreeStore } from '@/stores/file-tree.store'
import { useSettingsStore } from '@/stores/settings.store'
import type { CursorPosition, OutlineItem } from '@/types/editor.types'
import {
  buildFileBreadcrumbs,
  buildSymbolBreadcrumbs,
  type BreadcrumbSegment,
} from '@/lib/breadcrumbs'
import type { LanguageFeatureActions } from '@/services/editor/language-feature-manager'

function BreadcrumbButton({
  segment,
  onClick,
}: {
  segment: BreadcrumbSegment
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--bg-hover)] text-[11px] text-[var(--text-secondary)] transition-colors"
      title={segment.path ?? segment.label}
    >
      <span className="truncate max-w-[16rem]">{segment.label}</span>
    </button>
  )
}

function SymbolBreadcrumb({
  segment,
  onClick,
}: {
  segment: BreadcrumbSegment
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--bg-hover)] text-[11px] text-[var(--text-primary)] transition-colors"
      title={`${segment.kind ?? 'symbol'} @ ${segment.line ?? 1}:${segment.column ?? 1}`}
    >
      <span className="truncate max-w-[12rem] font-medium">{segment.label}</span>
    </button>
  )
}

export default function EditorBreadcrumbs({
  filePath,
  fileName,
  outlineItems,
  cursorPosition,
  actions,
}: {
  filePath: string
  fileName: string
  outlineItems: OutlineItem[]
  cursorPosition: CursorPosition
  actions: LanguageFeatureActions | null
}) {
  const setSelectedPath = useFileTreeStore((s) => s.setSelectedPath)
  const setSidebarPanel = useSettingsStore((s) => s.setSidebarPanel)
  const openFileAtPosition = useEditorStore((s) => s.openFileAtPosition)

  const fileBreadcrumbs = useMemo(() => buildFileBreadcrumbs(filePath), [filePath])
  const symbolBreadcrumbs = useMemo(
    () => buildSymbolBreadcrumbs(outlineItems, cursorPosition),
    [cursorPosition, outlineItems],
  )

  const handleFileCrumb = (segment: BreadcrumbSegment, isLeaf: boolean) => {
    if (!segment.path) return
    setSelectedPath(segment.path)
    setSidebarPanel('files')

    if (isLeaf) {
      void openFileAtPosition(filePath, cursorPosition.line, cursorPosition.column)
    }
  }

  const handleSymbolCrumb = (segment: BreadcrumbSegment) => {
    if (!segment.line || !segment.column) return
    void openFileAtPosition(filePath, segment.line, segment.column)
  }

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 overflow-hidden">
        <div className="min-w-0 flex items-center gap-2 overflow-hidden">
          <FolderOpen size={12} className="text-[var(--text-muted)] shrink-0" />
          <div className="flex items-center gap-0.5 min-w-0 overflow-hidden">
            {fileBreadcrumbs.map((segment, index) => {
              const isLeaf = index === fileBreadcrumbs.length - 1
              return (
                <div key={segment.id} className="flex items-center gap-0.5 min-w-0">
                  {index > 0 && <ChevronRight size={11} className="text-[var(--text-muted)] shrink-0" />}
                  <BreadcrumbButton segment={segment} onClick={() => handleFileCrumb(segment, isLeaf)} />
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => actions?.peekDefinition()}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            title="Peek Definition"
          >
            <Search size={12} />
            Peek
          </button>
          <button
            type="button"
            onClick={() => actions?.findReferences()}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            title="Find References"
          >
            <Search size={12} />
            References
          </button>
          <button
            type="button"
            onClick={() => actions?.renameSymbol()}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            title="Rename Symbol"
          >
            <SquarePen size={12} />
            Rename
          </button>
          <button
            type="button"
            onClick={() => actions?.quickFix()}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            title="Quick Fix"
          >
            <Wand2 size={12} />
            Fix
          </button>
        </div>
      </div>

      <div className="px-3 pb-1.5 flex items-center gap-1 overflow-x-auto">
        {symbolBreadcrumbs.length > 0 ? (
          <>
            {symbolBreadcrumbs.map((segment, index) => (
              <div key={segment.id} className="flex items-center gap-0.5 shrink-0">
                {index > 0 && <ChevronRight size={11} className="text-[var(--text-muted)] shrink-0" />}
                <SymbolBreadcrumb segment={segment} onClick={() => handleSymbolCrumb(segment)} />
              </div>
            ))}
          </>
        ) : (
          <span className="text-[11px] text-[var(--text-muted)]">No symbol under cursor in {fileName}</span>
        )}
      </div>
    </div>
  )
}
