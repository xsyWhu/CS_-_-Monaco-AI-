import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import FileTreeItem from './FileTreeItem'
import { useEditorStore } from '../../stores/editor.store'
import { useFileTreeStore } from '../../stores/file-tree.store'

/**
 * Day 8: 文件资源管理器——统一设计语言。
 */
export default function FileExplorer() {
  const { workspaceRoot, setWorkspaceRoot } = useFileTreeStore()
  const [treeNodes, setTreeNodes] = useState<FileTreeNode[]>([])
  const [isLoading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { openFilePath, setOpenFile } = useEditorStore()

  const loadTree = async () => {
    setLoading(true); setErrorMessage(null)
    try {
      const result = await window.api.getFileTree()
      setWorkspaceRoot(result.workspaceRoot)
      setTreeNodes(result.tree)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '读取文件树失败。')
    } finally { setLoading(false) }
  }

  const handleOpenFile = async (node: FileTreeNode) => {
    if (node.type !== 'file') return
    try {
      const content = await window.api.readFile(node.path)
      setOpenFile(node.path, content)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '读取文件内容失败。')
    }
  }

  useEffect(() => { void loadTree() }, [])

  return (
    <div className="h-full flex flex-col">
      {/* 工作区路径 + 刷新按钮 */}
      <div className="px-3 py-1.5 border-b border-[var(--color-border-subtle)] flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--color-fg-muted)] truncate" title={workspaceRoot}>
          {workspaceRoot || '加载中…'}
        </span>
        <button
          onClick={() => void loadTree()}
          className="p-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg-primary)]
                     transition-base cursor-pointer"
          title="刷新文件树"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1 px-1">
        {isLoading && (
          <p className="text-xs text-[var(--color-fg-muted)] px-2 py-2 animate-shimmer">正在加载…</p>
        )}
        {!isLoading && errorMessage && (
          <p className="text-xs text-[var(--color-error)] px-2 py-2 whitespace-pre-wrap">{errorMessage}</p>
        )}
        {!isLoading && !errorMessage && treeNodes.length === 0 && (
          <p className="text-xs text-[var(--color-fg-muted)] px-2 py-2">当前目录为空。</p>
        )}
        {!isLoading && !errorMessage && treeNodes.length > 0 && (
          <div>
            {treeNodes.map((node) => (
              <FileTreeItem key={node.path} node={node} depth={0} activeFilePath={openFilePath} onOpenFile={handleOpenFile} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
