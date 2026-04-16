import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'

interface FileTreeItemProps {
  node: FileTreeNode
  depth: number
  activeFilePath: string | null
  onOpenFile: (node: FileTreeNode) => void
}

/**
 * Day 8: 文件树节点——统一设计语言 + hover 过渡动画。
 */
export default function FileTreeItem({ node, depth, activeFilePath, onOpenFile }: FileTreeItemProps) {
  const [isExpanded, setExpanded] = useState(depth === 0)
  const isDirectory = node.type === 'directory'
  const isActive = node.type === 'file' && node.path === activeFilePath

  const handleClick = () => {
    if (isDirectory) { setExpanded((prev) => !prev); return }
    onOpenFile(node)
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-1.5 rounded-md px-2 py-[3px] text-left text-[13px]
                    cursor-pointer transition-base
          ${isActive
            ? 'bg-[var(--color-accent-muted)] text-[var(--color-accent)]'
            : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-fg-secondary)]'
          }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {isDirectory ? (
          isExpanded ? (
            <ChevronDown size={13} className="shrink-0 text-[var(--color-fg-muted)]" />
          ) : (
            <ChevronRight size={13} className="shrink-0 text-[var(--color-fg-muted)]" />
          )
        ) : (
          <span className="w-[13px] shrink-0" />
        )}

        {isDirectory ? (
          isExpanded ? (
            <FolderOpen size={14} className="shrink-0 text-[var(--color-warning)]" />
          ) : (
            <Folder size={14} className="shrink-0 text-[var(--color-fg-muted)]" />
          )
        ) : (
          <FileText size={14} className={`shrink-0 ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-muted)]'}`} />
        )}

        <span className="truncate">{node.name}</span>
      </button>

      {isDirectory && isExpanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((childNode) => (
            <FileTreeItem key={childNode.path} node={childNode} depth={depth + 1} activeFilePath={activeFilePath} onOpenFile={onOpenFile} />
          ))}
        </div>
      )}
    </div>
  )
}
