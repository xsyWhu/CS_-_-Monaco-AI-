import { File } from 'lucide-react'
import { useEditorStore } from '@/stores/editor.store'
import type { SearchResult, FileNameResult } from '@/types/electron'

interface Props {
  result: SearchResult | FileNameResult
  type: 'content' | 'fileName'
  query?: string
}

function highlightMatch(text: string, column: number, length: number) {
  if (!length || column < 0) return <span>{text}</span>

  const before = text.slice(0, column)
  const match = text.slice(column, column + length)
  const after = text.slice(column + length)

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

  const handleClick = () => {
    if (type === 'content') {
      const r = result as SearchResult
      openFile(r.filePath)
    } else {
      const r = result as FileNameResult
      openFile(r.filePath)
    }
  }

  if (type === 'content') {
    const r = result as SearchResult
    const parts = r.filePath.replace(/\\/g, '/').split('/')
    const fileName = parts.pop() || ''
    const dir = parts.slice(-2).join('/')

    return (
      <button
        onClick={handleClick}
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
      onClick={handleClick}
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
