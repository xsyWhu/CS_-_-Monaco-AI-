import { useState, useCallback, type MouseEvent } from 'react'
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileCode2,
  File,
  Loader2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useFileTreeStore } from '../../stores/file-tree.store'
import { useEditorStore } from '../../stores/editor.store'
import FileContextMenu from './FileContextMenu'
import type { FileTreeNode } from '../../types/editor.types'

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'css', 'scss', 'less',
  'html', 'htm', 'vue', 'svelte', 'md', 'mdx', 'py', 'rs', 'go', 'java',
  'kt', 'c', 'cpp', 'h', 'hpp', 'cs', 'rb', 'php', 'swift', 'dart',
  'lua', 'yaml', 'yml', 'toml', 'sh', 'bash', 'sql', 'graphql', 'xml',
])

function isCodeFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase()
  return ext ? CODE_EXTENSIONS.has(ext) : false
}

interface FileTreeItemProps {
  entry: FileTreeNode
  depth: number
}

export default function FileTreeItem({ entry, depth }: FileTreeItemProps) {
  const expandedDirs = useFileTreeStore((s) => s.expandedDirs)
  const selectedPath = useFileTreeStore((s) => s.selectedPath)
  const toggleDirectory = useFileTreeStore((s) => s.toggleDirectory)
  const loadChildren = useFileTreeStore((s) => s.loadChildren)
  const setSelectedPath = useFileTreeStore((s) => s.setSelectedPath)
  const openFile = useEditorStore((s) => s.openFile)

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const isExpanded = expandedDirs.has(entry.path)
  const isSelected = selectedPath === entry.path

  const handleClick = useCallback(() => {
    setSelectedPath(entry.path)
    if (entry.isDirectory) {
      toggleDirectory(entry.path)
      if (!expandedDirs.has(entry.path)) {
        loadChildren(entry.path)
      }
    } else {
      openFile(entry.path)
    }
  }, [entry.path, entry.isDirectory, expandedDirs, toggleDirectory, loadChildren, setSelectedPath, openFile])

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const FileIcon = entry.isDirectory
    ? isExpanded ? FolderOpen : Folder
    : isCodeFile(entry.name) ? FileCode2 : File

  const iconColor = entry.isDirectory
    ? 'text-[var(--accent)]'
    : 'text-[var(--text-muted)]'

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-1 py-[2px] cursor-pointer select-none group',
          'hover:bg-[var(--bg-hover)] transition-colors',
          isSelected && 'bg-[var(--bg-tertiary)]'
        )}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {entry.isDirectory ? (
          <ChevronRight
            size={14}
            className={cn(
              'shrink-0 text-[var(--text-muted)] transition-transform duration-150',
              isExpanded && 'rotate-90'
            )}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {entry.isLoading ? (
          <Loader2 size={14} className="shrink-0 text-[var(--text-muted)] animate-spin" />
        ) : (
          <FileIcon size={14} className={cn('shrink-0', iconColor)} />
        )}

        <span className="truncate text-[13px] text-[var(--text-primary)]">
          {entry.name}
        </span>
      </div>

      {entry.isDirectory && isExpanded && entry.children?.map((child) => (
        <FileTreeItem key={child.path} entry={child} depth={depth + 1} />
      ))}

      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetPath={entry.path}
          isDirectory={entry.isDirectory}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}
