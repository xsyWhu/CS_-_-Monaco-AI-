import { useCallback, useState } from 'react' // 1. 引入 useState
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

  // 2. 增加控制输入状态，不影响原有 UI 结构
  const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null)
  const [tempName, setTempName] = useState('')

  const rootName = rootPath?.split(/[/\\]/).pop() ?? null

  // 3. 提取创建逻辑
  const handleConfirmCreate = useCallback(async () => {
    const name = tempName.trim()
    if (name && rootPath) {
      if (isCreating === 'file') {
        await createFile(rootPath, name)
      } else {
        await createFolder(rootPath, name)
      }
    }
    setIsCreating(null)
    setTempName('')
  }, [isCreating, tempName, rootPath, createFile, createFolder])

  // 4. 修改处理函数：不再调用 prompt，而是开启输入状态
  const handleNewFile = useCallback(() => {
    if (!rootPath) return
    setIsCreating('file')
    setTempName('')
  }, [rootPath])

  const handleNewFolder = useCallback(() => {
    if (!rootPath) return
    setIsCreating('folder')
    setTempName('')
  }, [rootPath])

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

            {/* 5. 核心修复：在列表顶部插入一个高度一致的输入框 */}
            {isCreating && (
              <div className="px-4 py-1 flex items-center bg-[var(--bg-tertiary)] border-l-2 border-[var(--accent)]">
                <input
                  autoFocus
                  className="w-full bg-transparent border-none outline-none text-[13px] text-[var(--text-primary)]"
                  placeholder={isCreating === 'file' ? "file name..." : "folder name..."}
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmCreate()
                    if (e.key === 'Escape') setIsCreating(null)
                  }}
                  onBlur={() => {
                    // 失去焦点时，如果有内容则尝试创建，没内容则取消
                    if (tempName.trim()) handleConfirmCreate()
                    else setIsCreating(null)
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