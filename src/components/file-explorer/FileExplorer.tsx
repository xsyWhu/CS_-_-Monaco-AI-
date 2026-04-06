import { useCallback, useRef, useState } from 'react'
import { ChevronsDownUp, File, FilePlus, FolderOpen, FolderPlus, RefreshCw } from 'lucide-react'
import { useFileTreeStore } from '../../stores/file-tree.store'
import { useEditorStore } from '../../stores/editor.store'
import FileTreeItem from './FileTreeItem'

interface NamingState {
  type: 'file' | 'folder'
  parentPath: string
}

export default function FileExplorer() {
  const rootPath = useFileTreeStore((s) => s.rootPath)
  const entries = useFileTreeStore((s) => s.entries)
  const openFolder = useFileTreeStore((s) => s.openFolder)
  const selectFile = useFileTreeStore((s) => s.selectFile)
  const setRootPath = useFileTreeStore((s) => s.setRootPath)
  const setSelectedPath = useFileTreeStore((s) => s.setSelectedPath)
  const refreshTree = useFileTreeStore((s) => s.refreshTree)
  const collapseAll = useFileTreeStore((s) => s.collapseAll)
  const createFile = useFileTreeStore((s) => s.createFile)
  const createFolder = useFileTreeStore((s) => s.createFolder)

  const openFile = useEditorStore((s) => s.openFile)

  const [naming, setNaming] = useState<NamingState | null>(null)
  const [tempName, setTempName] = useState('')
  const isSubmitting = useRef(false)

  const rootName = rootPath?.split(/[/\\]/).pop() ?? null

  const handleConfirmCreate = useCallback(async () => {
    if (isSubmitting.current) return

    const name = tempName.trim()
    if (name && naming) {
      isSubmitting.current = true
      try {
        if (naming.type === 'file') {
          await createFile(naming.parentPath, name)
        } else {
          await createFolder(naming.parentPath, name)
        }
      } finally {
        isSubmitting.current = false
      }
    }

    setNaming(null)
    setTempName('')
  }, [naming, tempName, createFile, createFolder])

  const handleNewFile = useCallback(() => {
    if (!rootPath || naming) return
    setNaming({ type: 'file', parentPath: rootPath })
    setTempName('')
  }, [rootPath, naming])

  const handleNewFolder = useCallback(() => {
    if (!rootPath || naming) return
    setNaming({ type: 'folder', parentPath: rootPath })
    setTempName('')
  }, [rootPath, naming])

  const handleCancel = useCallback(() => {
    setNaming(null)
    setTempName('')
  }, [])

  const handleOpenFolder = useCallback(async () => {
    await openFolder()
  }, [openFolder])

  const handleOpenFile = useCallback(async () => {
    const selectedFile = await selectFile()
    if (!selectedFile) return

    const sep = selectedFile.includes('\\') ? '\\' : '/'
    const parts = selectedFile.split(/[/\\]/)
    parts.pop()
    const parentPath = parts.join(sep)

    if (parentPath) {
      await setRootPath(parentPath)
      setSelectedPath(selectedFile)
    }

    await openFile(selectedFile)
  }, [selectFile, setRootPath, setSelectedPath, openFile])

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between px-4 py-2 text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase shrink-0">
        <span>Explorer</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => {
              void handleOpenFile()
            }}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Open File"
          >
            <File size={14} />
          </button>
          <button
            onClick={() => {
              void handleOpenFolder()
            }}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Open Folder"
          >
            <FolderOpen size={14} />
          </button>

          {rootPath && (
            <>
              <button
                onClick={handleNewFile}
                disabled={!!naming}
                className={`p-1 rounded transition-colors ${
                  naming
                    ? 'opacity-30 cursor-not-allowed'
                    : 'hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="New File"
              >
                <FilePlus size={14} />
              </button>
              <button
                onClick={handleNewFolder}
                disabled={!!naming}
                className={`p-1 rounded transition-colors ${
                  naming
                    ? 'opacity-30 cursor-not-allowed'
                    : 'hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
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
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {!rootPath ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
            <p className="text-[var(--text-muted)] text-xs text-center">No folder opened yet.</p>
            <button
              onClick={() => {
                void handleOpenFolder()
              }}
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

            {naming && (
              <div className="px-4 py-1 flex items-center bg-[var(--bg-tertiary)] border-l-2 border-[var(--accent)]">
                <input
                  autoFocus
                  className="w-full bg-transparent border-none outline-none text-[13px] text-[var(--text-primary)]"
                  placeholder={naming.type === 'file' ? 'file name...' : 'folder name...'}
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') void handleConfirmCreate()
                    if (e.key === 'Escape') handleCancel()
                  }}
                  onBlur={() => {
                    if (tempName.trim()) {
                      void handleConfirmCreate()
                    } else {
                      handleCancel()
                    }
                  }}
                />
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
