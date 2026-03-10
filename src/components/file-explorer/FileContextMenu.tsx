import { useEffect, useRef, useCallback } from 'react'
import { useFileTreeStore } from '../../stores/file-tree.store'

interface FileContextMenuProps {
  x: number
  y: number
  targetPath: string
  isDirectory: boolean
  onClose: () => void
}

export default function FileContextMenu({
  x,
  y,
  targetPath,
  isDirectory,
  onClose,
}: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const { createFile, createFolder, deleteEntry, renameEntry } = useFileTreeStore()

  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${window.innerWidth - rect.width - 4}px`
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${window.innerHeight - rect.height - 4}px`
    }
  }, [x, y])

  const containerDir = isDirectory
    ? targetPath
    : targetPath.replace(/[/\\][^/\\]*$/, '')

  const handleNewFile = useCallback(() => {
    const name = prompt('Enter file name:')
    if (name) createFile(containerDir, name)
    onClose()
  }, [containerDir, createFile, onClose])

  const handleNewFolder = useCallback(() => {
    const name = prompt('Enter folder name:')
    if (name) createFolder(containerDir, name)
    onClose()
  }, [containerDir, createFolder, onClose])

  const handleRename = useCallback(() => {
    const currentName = targetPath.split(/[/\\]/).pop() || ''
    const newName = prompt('Enter new name:', currentName)
    if (newName && newName !== currentName) {
      const newPath = targetPath.replace(/[^/\\]+$/, newName)
      renameEntry(targetPath, newPath)
    }
    onClose()
  }, [targetPath, renameEntry, onClose])

  const handleDelete = useCallback(() => {
    const name = targetPath.split(/[/\\]/).pop() || targetPath
    if (confirm(`Delete "${name}"?`)) {
      deleteEntry(targetPath)
    }
    onClose()
  }, [targetPath, deleteEntry, onClose])

  const handleCopyPath = useCallback(() => {
    navigator.clipboard.writeText(targetPath)
    onClose()
  }, [targetPath, onClose])

  const menuItems: Array<{ label: string; handler: () => void } | 'separator'> = [
    { label: 'New File', handler: handleNewFile },
    { label: 'New Folder', handler: handleNewFolder },
    'separator',
    { label: 'Rename', handler: handleRename },
    { label: 'Delete', handler: handleDelete },
    'separator',
    { label: 'Copy Path', handler: handleCopyPath },
  ]

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md shadow-xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, i) =>
        item === 'separator' ? (
          <div key={i} className="my-1 border-t border-[var(--border)]" />
        ) : (
          <button
            key={item.label}
            onClick={item.handler}
            className="w-full px-3 py-1.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
