import { useCallback } from 'react'
import { FilePlus, FolderPlus, RefreshCw, ChevronsDownUp } from 'lucide-react'
import { useFileTreeStore } from '../../stores/file-tree.store'
import FileTreeItem from './FileTreeItem'

export default function FileExplorer() {
  const rootPath = useFileTreeStore((s) => s.rootPath)
  const entries = useFileTreeStore((s) => s.entries)
  const openFolder = useFileTreeStore((s) => s.openFolder)
  const refreshTree = useFileTreeStore((s) => s.refreshTree)
  const collapseAll = useFileTreeStore((s) => s.collapseAll)
  const createFile = useFileTreeStore((s) => s.createFile)
  const createFolder = useFileTreeStore((s) => s.createFolder)

  const rootName = rootPath?.split(/[/\\]/).pop() ?? null

  const handleNewFile = useCallback(() => {
    if (!rootPath) return
    const name = prompt('Enter file name:')
    if (name) createFile(rootPath, name)
  }, [rootPath, createFile])

  const handleNewFolder = useCallback(() => {
    if (!rootPath) return
    const name = prompt('Enter folder name:')
    if (name) createFolder(rootPath, name)
  }, [rootPath, createFolder])

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between px-4 py-2 text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase shrink-0">
        <span>Explorer</span>
        {rootPath && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleNewFile}
              className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="New File"
            >
              <FilePlus size={14} />
            </button>
            <button
              onClick={handleNewFolder}
              className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="New Folder"
            >
              <FolderPlus size={14} />
            </button>
            <button
              onClick={() => refreshTree()}
              className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="Refresh Explorer"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={collapseAll}
              className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="Collapse All"
            >
              <ChevronsDownUp size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {!rootPath ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
            <p className="text-[var(--text-muted)] text-xs text-center">
              No folder opened yet.
            </p>
            <button
              onClick={() => openFolder()}
              className="px-4 py-1.5 rounded text-xs bg-[var(--accent)] text-[var(--bg-primary)] font-medium hover:opacity-90 transition-opacity"
            >
              Open Folder
            </button>
          </div>
        ) : (
          <div className="py-1">
            {rootName && (
              <div className="px-3 py-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase truncate">
                {rootName}
              </div>
            )}
            {entries.map((entry) => (
              <FileTreeItem key={entry.path} entry={entry} depth={0} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
