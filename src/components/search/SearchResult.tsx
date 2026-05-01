import { File } from 'lucide-react'
import { useEditorStore } from '@/stores/editor.store'
import { useFileTreeStore } from '@/stores/file-tree.store'
import type { SearchResult, FileNameResult } from '@/types/electron'

interface Props {
  result: SearchResult | FileNameResult
  type: 'content' | 'fileName'
  query?: string
}

function highlightMatch(text: string, column: number, length: number) {
  if (!length || column <= 0) return <span>{text}</span>

  const startIndex = column - 1

  const before = text.slice(0, startIndex)
  const match = text.slice(startIndex, startIndex + length)
  const after = text.slice(startIndex + length)

  return (
    <>
      {before}
      <span className="bg-[var(--accent)]/30 text-[var(--accent)] rounded-sm px-0.5">
        {match}
      </span>
      {after}
    </>
  )
}

function highlightText(text: string, query: string) {
  if (!query) return <span>{text}</span>

  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>

  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-[var(--accent)]/30 text-[var(--accent)] rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function SearchResultItem({ result, type, query }: Props) {
  const openFile = useEditorStore((s) => s.openFile)
  const openFileAtPosition = useEditorStore((s) => s.openFileAtPosition)
  const confirmAndHandleDirtyTabs = useEditorStore((s) => s.confirmAndHandleDirtyTabs)
  const pruneTabsByWorkspace = useEditorStore((s) => s.pruneTabsByWorkspace)
  const rootPath = useFileTreeStore((s) => s.rootPath)
  const setRootPath = useFileTreeStore((s) => s.setRootPath)
  const setSelectedPath = useFileTreeStore((s) => s.setSelectedPath)

  const ensureWorkspaceForFile = async (filePath: string) => {
    const currentRoot = rootPath?.replace(/\\/g, '/').toLowerCase() ?? ''
    const targetPath = filePath.replace(/\\/g, '/').toLowerCase()

    if (!currentRoot || !targetPath.startsWith(`${currentRoot}/`)) {
      const sep = filePath.includes('\\') ? '\\' : '/'
      const parentParts = filePath.split(/[/\\]/)
      parentParts.pop()
      const parentPath = parentParts.join(sep)
      if (parentPath) {
        const confirmed = await confirmAndHandleDirtyTabs()
        if (!confirmed) return
        await setRootPath(parentPath)
        pruneTabsByWorkspace(parentPath)
      }
    }

    setSelectedPath(filePath)
  }

  const handleClick = async () => {
    if (type === 'content') {
      const r = result as SearchResult
      await ensureWorkspaceForFile(r.filePath)
      await openFileAtPosition(r.filePath, r.line, r.column)
    } else {
      const r = result as FileNameResult
      await ensureWorkspaceForFile(r.filePath)
      await openFile(r.filePath)
    }
  }

  if (type === 'content') {
    const r = result as SearchResult
    const parts = r.filePath.replace(/\\/g, '/').split('/')
    const fileName = parts.pop() || ''
    const dir = parts.slice(-2).join('/')

    return (
      <button
        onClick={() => {
          void handleClick()
        }}
        className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border)]/30"
      >
        <div className="flex items-center gap-1.5 text-xs">
          <File size={12} className="text-[var(--text-muted)] flex-shrink-0" />
          <span className="text-[var(--text-primary)] font-medium truncate">{fileName}</span>
          {dir && (
            <span className="text-[var(--text-muted)] truncate text-[10px]">{dir}</span>
          )}
          <span className="ml-auto text-[var(--text-muted)] flex-shrink-0">:{r.line}</span>
        </div>
        <div className="mt-0.5 text-xs font-mono text-[var(--text-secondary)] truncate pl-5">
          {highlightMatch(r.lineContent, r.column, r.matchLength)}
        </div>
      </button>
    )
  }

  const r = result as FileNameResult
  const parts = r.filePath.replace(/\\/g, '/').split('/')
  const dir = parts.slice(-3, -1).join('/')

  return (
    <button
      onClick={() => {
        void handleClick()
      }}
      draggable={type === 'fileName' || type === 'content'}
      onDragStart={(e) => {
        const filePath = type === 'content' ? (result as SearchResult).filePath : (result as FileNameResult).filePath
        e.dataTransfer.setData('text/plain', filePath)
        e.dataTransfer.effectAllowed = 'copyMove'
      }}
      className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border)]/30"
    >
      <div className="flex items-center gap-1.5 text-xs">
        <File size={12} className="text-[var(--text-muted)] flex-shrink-0" />
        <span className="text-[var(--text-primary)] font-medium">
          {query ? highlightText(r.fileName, query) : r.fileName}
        </span>
      </div>
      {dir && (
        <div className="text-[10px] text-[var(--text-muted)] truncate pl-5 mt-0.5">{dir}</div>
      )}
    </button>
  )
}
