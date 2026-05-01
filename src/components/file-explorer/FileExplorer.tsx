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
  const recentWorkspaces = useFileTreeStore((s) => s.recentWorkspaces)
  const selectFile = useFileTreeStore((s) => s.selectFile)
  const setRootPath = useFileTreeStore((s) => s.setRootPath)
  const setSelectedPath = useFileTreeStore((s) => s.setSelectedPath)
  const refreshTree = useFileTreeStore((s) => s.refreshTree)
  const collapseAll = useFileTreeStore((s) => s.collapseAll)
  const createFile = useFileTreeStore((s) => s.createFile)
  const createFolder = useFileTreeStore((s) => s.createFolder)

  const openFile = useEditorStore((s) => s.openFile)
  const recentFiles = useEditorStore((s) => s.recentFiles)
  const confirmAndHandleDirtyTabs = useEditorStore((s) => s.confirmAndHandleDirtyTabs)
  const pruneTabsByWorkspace = useEditorStore((s) => s.pruneTabsByWorkspace)

  const [naming, setNaming] = useState<NamingState | null>(null)
  const [tempName, setTempName] = useState('')
  const isSubmitting = useRef(false)

  const rootName = rootPath?.split(/[/\\]/).pop() ?? null

  const ensureWorkspaceForFile = useCallback(
    async (filePath: string) => {
      const currentRoot = rootPath?.replace(/\\/g, '/').toLowerCase() ?? ''
      const targetPath = filePath.replace(/\\/g, '/').toLowerCase()

      if (!currentRoot || !targetPath.startsWith(`${currentRoot}/`)) {
        const sep = filePath.includes('\\') ? '\\' : '/'
        const parentParts = filePath.split(/[/\\]/)
        parentParts.pop()
        const parentPath = parentParts.join(sep)
        if (parentPath) {
          await setRootPath(parentPath)
          pruneTabsByWorkspace(parentPath)
        }
      }

      setSelectedPath(filePath)
    },
    [rootPath, pruneTabsByWorkspace, setRootPath, setSelectedPath],
  )

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
    const selected = await window.api.selectDirectory()
    if (!selected) return

    const currentRoot = rootPath?.replace(/\\/g, '/').toLowerCase() ?? ''
    const nextRoot = selected.replace(/\\/g, '/').toLowerCase()

    if (currentRoot && currentRoot !== nextRoot) {
      const confirmed = await confirmAndHandleDirtyTabs()
      if (!confirmed) return
    }

    await setRootPath(selected)
    pruneTabsByWorkspace(selected)
  }, [rootPath, confirmAndHandleDirtyTabs, setRootPath, pruneTabsByWorkspace])

  const handleOpenFile = useCallback(async () => {
    const selectedFile = await selectFile()
    if (!selectedFile) return

    const sep = selectedFile.includes('\\') ? '\\' : '/'
    const parts = selectedFile.split(/[/\\]/)
    parts.pop()
    const parentPath = parts.join(sep)

    if (parentPath) {
      const currentRoot = rootPath?.replace(/\\/g, '/').toLowerCase() ?? ''
      const nextRoot = parentPath.replace(/\\/g, '/').toLowerCase()
      if (currentRoot && currentRoot !== nextRoot) {
        const confirmed = await confirmAndHandleDirtyTabs()
        if (!confirmed) return
      }

      await setRootPath(parentPath)
      pruneTabsByWorkspace(parentPath)
      setSelectedPath(selectedFile)
    }

    await openFile(selectedFile)
  }, [
    selectFile,
    rootPath,
    confirmAndHandleDirtyTabs,
    setRootPath,
    pruneTabsByWorkspace,
    setSelectedPath,
    openFile,
  ])

  const handleOpenRecentWorkspace = useCallback(
    async (workspace: string) => {
      const currentRoot = rootPath?.replace(/\\/g, '/').toLowerCase() ?? ''
      const nextRoot = workspace.replace(/\\/g, '/').toLowerCase()
      if (currentRoot === nextRoot) return

      const confirmed = await confirmAndHandleDirtyTabs()
      if (!confirmed) return

      await setRootPath(workspace)
      pruneTabsByWorkspace(workspace)
    },
    [rootPath, confirmAndHandleDirtyTabs, setRootPath, pruneTabsByWorkspace],
  )

  const handleOpenRecentFile = useCallback(
    async (filePath: string) => {
      const sep = filePath.includes('\\') ? '\\' : '/'
      const parentParts = filePath.split(/[/\\]/)
      parentParts.pop()
      const parentPath = parentParts.join(sep)
      const currentRoot = rootPath?.replace(/\\/g, '/').toLowerCase() ?? ''
      const nextRoot = parentPath.replace(/\\/g, '/').toLowerCase()

      if (parentPath && currentRoot !== nextRoot) {
        const confirmed = await confirmAndHandleDirtyTabs()
        if (!confirmed) return
        await setRootPath(parentPath)
        pruneTabsByWorkspace(parentPath)
      }

      await ensureWorkspaceForFile(filePath)
      await openFile(filePath)
    },
    [ensureWorkspaceForFile, confirmAndHandleDirtyTabs, openFile, pruneTabsByWorkspace, rootPath, setRootPath],
  )

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
          <div className="py-1 space-y-3">
            {(recentWorkspaces.length > 0 || recentFiles.length > 0) && (
              <div className="px-3">
                {recentWorkspaces.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Recent Workspaces
                    </div>
                    <div className="space-y-1">
                      {recentWorkspaces.map((workspace) => (
                        <button
                          key={workspace}
                          onClick={() => {
                            void handleOpenRecentWorkspace(workspace)
                          }}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--bg-hover)] text-xs text-[var(--text-primary)] truncate"
                        >
                          {workspace}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {recentFiles.length > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Recent Files
                    </div>
                    <div className="space-y-1">
                      {recentFiles.slice(0, 8).map((filePath) => (
                        <button
                          key={filePath}
                          onClick={() => {
                            void handleOpenRecentFile(filePath)
                          }}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--bg-hover)] text-xs text-[var(--text-primary)] truncate"
                        >
                          {filePath}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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
