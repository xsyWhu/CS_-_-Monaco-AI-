import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, File, MapPinned, Clock3 } from 'lucide-react'
import { useEditorStore } from '@/stores/editor.store'
import { useFileTreeStore } from '@/stores/file-tree.store'

type CommandPaletteMode = 'quickOpen' | 'gotoLine'

interface CommandPaletteProps {
  isOpen: boolean
  mode: CommandPaletteMode
  onClose: () => void
}

interface QuickOpenResult {
  filePath: string
  fileName: string
  source: 'recent' | 'open' | 'search'
}

export default function CommandPalette({ isOpen, mode, onClose }: CommandPaletteProps) {
  const rootPath = useFileTreeStore((s) => s.rootPath)
  const tabs = useEditorStore((s) => s.tabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const recentFiles = useEditorStore((s) => s.recentFiles)
  const openFile = useEditorStore((s) => s.openFile)
  const openFileAtPosition = useEditorStore((s) => s.openFileAtPosition)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<QuickOpenResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setSelectedIndex(0)
    setResults([])
    const timer = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    return () => clearTimeout(timer)
  }, [isOpen, mode])

  const mergedResults = useMemo(() => {
    const list = [...results]
    const seen = new Set<string>()
    return list.filter((item) => {
      const key = item.filePath.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [results])

  useEffect(() => {
    if (!isOpen || mode !== 'quickOpen') return

    const trimmed = query.trim()
    if (!rootPath) {
      const fallback = recentFiles
        .map((filePath) => ({
          filePath,
          fileName: filePath.split(/[/\\]/).pop() || filePath,
          source: 'recent' as const,
        }))
        .filter((item) =>
          trimmed ? item.fileName.toLowerCase().includes(trimmed.toLowerCase()) : true,
        )
      setResults(fallback)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const searchResults = trimmed
          ? await window.api.searchFileNames(rootPath, trimmed)
          : []

        const tabResults = tabs
          .map((tab) => ({
            filePath: tab.filePath,
            fileName: tab.fileName,
            source: 'open' as const,
          }))
          .filter((item) =>
            trimmed ? item.fileName.toLowerCase().includes(trimmed.toLowerCase()) : true,
          )

        const recentResults = recentFiles
          .map((filePath) => ({
            filePath,
            fileName: filePath.split(/[/\\]/).pop() || filePath,
            source: 'recent' as const,
          }))
          .filter((item) =>
            trimmed ? item.fileName.toLowerCase().includes(trimmed.toLowerCase()) : true,
          )

        const apiResults = searchResults.map((item) => ({
          filePath: item.filePath,
          fileName: item.fileName,
          source: 'search' as const,
        }))

        if (!controller.signal.aborted) {
          setResults([...tabResults, ...recentResults, ...apiResults].slice(0, 50))
          setSelectedIndex(0)
        }
      } catch (error) {
        console.error('Quick open search failed:', error)
        if (!controller.signal.aborted) {
          setResults([])
        }
      }
    }, 150)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [isOpen, mode, query, rootPath, tabs, recentFiles])

  const handleSelect = async (filePath: string) => {
    await openFile(filePath)
    onClose()
  }

  const handleGoToLine = async () => {
    if (!activeTab) return

    const normalized = query.trim()
    if (!normalized) return

    const [lineText, columnText] = normalized.split(':')
    const line = Math.max(1, Number(lineText) || 1)
    const column = Math.max(1, Number(columnText) || 1)
    await openFileAtPosition(activeTab.filePath, line, column)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-16 bg-black/30"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl mx-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
          {mode === 'quickOpen' ? <Search size={16} className="text-[var(--accent)]" /> : <MapPinned size={16} className="text-[var(--accent)]" />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
                return
              }

              if (mode === 'quickOpen') {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setSelectedIndex((index) => Math.min(index + 1, mergedResults.length - 1))
                  return
                }

                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setSelectedIndex((index) => Math.max(index - 1, 0))
                  return
                }

                if (e.key === 'Enter') {
                  e.preventDefault()
                  const item = mergedResults[selectedIndex]
                  if (item) {
                    await handleSelect(item.filePath)
                  }
                  return
                }
              }

              if (mode === 'gotoLine' && e.key === 'Enter') {
                e.preventDefault()
                await handleGoToLine()
              }
            }}
            placeholder={mode === 'quickOpen' ? 'Type a file name to open' : 'Line or line:column'}
            className="w-full bg-transparent outline-none text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)]"
          />
        </div>

        {mode === 'quickOpen' && (
          <div className="max-h-[420px] overflow-y-auto">
            {mergedResults.length === 0 ? (
              <div className="px-4 py-6 text-sm text-[var(--text-muted)]">
                {rootPath ? 'No matching files' : 'Open a folder first'}
              </div>
            ) : (
              mergedResults.map((item, index) => (
                <button
                  key={`${item.filePath}:${index}`}
                  onClick={() => {
                    void handleSelect(item.filePath)
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-[var(--border)]/30 flex items-center gap-3 transition-colors ${
                    index === selectedIndex
                      ? 'bg-[var(--bg-hover)]'
                      : 'hover:bg-[var(--bg-hover)]/60'
                  }`}
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)] shrink-0">
                    {item.source === 'recent' ? <Clock3 size={14} /> : <File size={14} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-[var(--text-primary)] truncate">
                      {item.fileName}
                    </span>
                    <span className="block text-xs text-[var(--text-muted)] truncate">
                      {item.filePath}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {mode === 'gotoLine' && (
          <div className="px-4 py-4 text-sm text-[var(--text-muted)]">
            {activeTab ? (
              <>
                <div className="mb-2 text-[var(--text-secondary)]">
                  Jump in <span className="text-[var(--text-primary)]">{activeTab.fileName}</span>
                </div>
                <div>Use `line` or `line:column`, then press Enter.</div>
              </>
            ) : (
              <div>No active file.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
