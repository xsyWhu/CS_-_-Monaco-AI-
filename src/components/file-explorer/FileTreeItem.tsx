import { useState, useCallback, useRef, useEffect, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
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

const CODE_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'scss', 'html', 'vue', 'md', 'py', 'rs', 'go'])

function isCodeFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase()
  return ext ? CODE_EXTENSIONS.has(ext) : false
}

export default function FileTreeItem({ entry, depth }: { entry: FileTreeNode; depth: number }) {
  const { 
    expandedDirs, selectedPath, toggleDirectory, loadChildren, 
    setSelectedPath, renameEntry, createFile, createFolder 
  } = useFileTreeStore()
  const openFile = useEditorStore((s) => s.openFile)

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 【修正点】定义缺失的变量
  const isExpanded = expandedDirs.has(entry.path)
  const isSelected = selectedPath === entry.path

  // 焦点保护：延迟一帧后聚焦，避免与 onBlur 产生竞态。
  // 原先用 setInterval 反复抢焦点，会在用户点击别处时与 onBlur→setIsCreating(null)
  // 产生竞争：interval 在 React 提交状态更新前重新 focus，导致输入框"粘住"无法关闭。
  useEffect(() => {
    if (isEditing || isCreating) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          if (isEditing) inputRef.current.select();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isEditing, isCreating]);

  const handleRenameSubmit = async () => {
    const name = inputValue.trim()
    if (name && name !== entry.name) {
      const parts = entry.path.split(/[/\\]/)
      parts.pop()
      const parentPath = parts.join('/')
      const sep = entry.path.includes('\\') ? '\\' : '/'
      await renameEntry(entry.path, parentPath ? `${parentPath}${sep}${name}` : name)
    }
    setIsEditing(false)
  }

  const handleCreateSubmit = async () => {
    const name = inputValue.trim()
    if (name && isCreating) {
      try {
        if (isCreating === 'file') await createFile(entry.path, name)
        else await createFolder(entry.path, name)
        if (!isExpanded) toggleDirectory(entry.path)
      } catch (e) { console.error("Creation failed", e) }
    }
    setIsCreating(null)
    setInputValue('')
  }

  const handleInputEvents = (e: React.KeyboardEvent | React.MouseEvent) => {
    e.stopPropagation();
    if ('nativeEvent' in e) {
      e.nativeEvent.stopImmediatePropagation();
    }
  }

  const FileIcon = entry.isDirectory ? (isExpanded ? FolderOpen : Folder) : (isCodeFile(entry.name) ? FileCode2 : File)

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-1 py-[2px] cursor-pointer select-none group hover:bg-[var(--bg-hover)] relative z-10',
          isSelected && 'bg-[var(--bg-tertiary)]'
        )}
        style={{ paddingLeft: depth * 16 + 8 }}
        draggable={!entry.isDirectory}
        onDragStart={(e) => {
          if (entry.isDirectory) return
          e.dataTransfer.setData('text/plain', entry.path)
          e.dataTransfer.effectAllowed = 'copyMove'
        }}
        onClick={() => { 
          setSelectedPath(entry.path)
          if (entry.isDirectory) { 
            toggleDirectory(entry.path)
            if (!isExpanded) loadChildren(entry.path) 
          } else {
            openFile(entry.path)
          }
        }}
        onContextMenu={(e) => { 
          e.preventDefault()
          e.stopPropagation()
          setSelectedPath(entry.path)
          setContextMenu({ x: e.clientX, y: e.clientY }) 
        }}
      >
        {entry.isDirectory ? <ChevronRight size={14} className={cn('text-[var(--text-muted)] transition-transform', isExpanded && 'rotate-90')} /> : <span className="w-3.5" />}
        {entry.isLoading ? <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" /> : <FileIcon size={14} className={entry.isDirectory ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'} />}

        {isEditing ? (
          <input
            ref={inputRef}
            className="flex-1 bg-[var(--bg-primary)] text-[13px] outline-none border border-[var(--accent)] px-1 mx-1 rounded-sm relative z-20"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              handleInputEvents(e);
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            onKeyUp={handleInputEvents}
            onClick={handleInputEvents}
          />
        ) : (
          <span className="truncate text-[13px] text-[var(--text-primary)]">{entry.name}</span>
        )}
      </div>

      {entry.isDirectory && isCreating && (
        <div className="flex items-center gap-1 py-[2px] relative z-20" style={{ paddingLeft: (depth + 1) * 16 + 8 }}>
          <span className="w-3.5 shrink-0" />
          {isCreating === 'file' ? <File size={14} className="text-[var(--text-muted)]" /> : <Folder size={14} className="text-[var(--accent)]" />}
          <input
            ref={inputRef}
            className="flex-1 bg-[var(--bg-primary)] text-[13px] outline-none border border-[var(--accent)] px-1 mx-1 rounded-sm"
            placeholder="Name..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleCreateSubmit}
            onKeyDown={(e) => {
              handleInputEvents(e);
              if (e.key === 'Enter') handleCreateSubmit();
              if (e.key === 'Escape') setIsCreating(null);
            }}
            onKeyUp={handleInputEvents}
            onClick={handleInputEvents}
          />
        </div>
      )}

      {entry.isDirectory && isExpanded && entry.children?.map((child) => (
        <FileTreeItem key={child.path} entry={child} depth={depth + 1} />
      ))}

      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x} y={contextMenu.y} targetPath={entry.path} isDirectory={entry.isDirectory}
          onClose={() => setContextMenu(null)}
          onRename={() => { flushSync(() => { setInputValue(entry.name); setIsEditing(true); }); }}
          onNewFile={() => { flushSync(() => { if (!isExpanded) toggleDirectory(entry.path); setIsCreating('file'); setInputValue(''); }); }}
          onNewFolder={() => { flushSync(() => { if (!isExpanded) toggleDirectory(entry.path); setIsCreating('folder'); setInputValue(''); }); }}
        />
      )}
    </>
  )
}
