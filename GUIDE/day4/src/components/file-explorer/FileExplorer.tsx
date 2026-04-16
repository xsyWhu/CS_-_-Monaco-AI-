import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import FileTreeItem from './FileTreeItem'
import { useEditorStore } from '../../stores/editor.store'

export default function FileExplorer() {
  const [workspaceRoot, setWorkspaceRoot] = useState('')
  const [treeNodes, setTreeNodes] = useState<FileTreeNode[]>([])
  const [isLoading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { openFilePath, setOpenFile } = useEditorStore()

  const loadTree = async () => {
    setLoading(true)
    setErrorMessage(null)

    try {
      const result = await window.api.getFileTree()
      setWorkspaceRoot(result.workspaceRoot)
      setTreeNodes(result.tree)
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取文件树失败。'
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenFile = async (node: FileTreeNode) => {
    if (node.type !== 'file') {
      return
    }

    try {
      const content = await window.api.readFile(node.path)
      setOpenFile(node.path, content)
      setErrorMessage(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取文件内容失败。'
      setErrorMessage(message)
    }
  }

  useEffect(() => {
    void loadTree()
  }, [])

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400 truncate" title={workspaceRoot}>
          {workspaceRoot || 'Loading workspace...'}
        </span>
        <button
          onClick={() => {
            void loadTree()
          }}
          className="p-1 text-gray-400 hover:text-white cursor-pointer"
          title="刷新文件树"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading && <p className="text-xs text-gray-500">正在加载文件树...</p>}

        {!isLoading && errorMessage && <p className="text-xs text-red-400 whitespace-pre-wrap">{errorMessage}</p>}

        {!isLoading && !errorMessage && treeNodes.length === 0 && (
          <p className="text-xs text-gray-500">当前目录没有可显示文件。</p>
        )}

        {!isLoading && !errorMessage && treeNodes.length > 0 && (
          <div className="space-y-0.5">
            {treeNodes.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                depth={0}
                activeFilePath={openFilePath}
                onOpenFile={handleOpenFile}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
