import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'

interface FileTreeItemProps {
  node: FileTreeNode
  depth: number
  activeFilePath: string | null
  onOpenFile: (node: FileTreeNode) => void
}

export default function FileTreeItem({
  node,
  depth,
  activeFilePath,
  onOpenFile
}: FileTreeItemProps) {
  const [isExpanded, setExpanded] = useState(depth === 0)
  const isDirectory = node.type === 'directory'
  const isActive = node.type === 'file' && node.path === activeFilePath

  const handleClick = () => {
    if (isDirectory) {
      setExpanded((prev) => !prev)
      return
    }

    onOpenFile(node)
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-1 rounded px-2 py-1 text-left text-sm cursor-pointer ${
          isActive ? 'bg-blue-600 text-white' : 'hover:bg-[#2a2d2e] text-foreground'
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {isDirectory ? (
          isExpanded ? (
            <ChevronDown size={14} className="shrink-0" />
          ) : (
            <ChevronRight size={14} className="shrink-0" />
          )
        ) : (
          <span className="w-[14px] shrink-0" />
        )}

        {isDirectory ? (
          isExpanded ? (
            <FolderOpen size={14} className="shrink-0" />
          ) : (
            <Folder size={14} className="shrink-0" />
          )
        ) : (
          <FileText size={14} className="shrink-0" />
        )}

        <span className="truncate">{node.name}</span>
      </button>

      {isDirectory && isExpanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((childNode) => (
            <FileTreeItem
              key={childNode.path}
              node={childNode}
              depth={depth + 1}
              activeFilePath={activeFilePath}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}
