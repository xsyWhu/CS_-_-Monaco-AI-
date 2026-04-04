import { useEffect, useRef, useCallback } from 'react'
import { useFileTreeStore } from '../../stores/file-tree.store'

interface FileContextMenuProps {
  x: number; y: number; targetPath: string; isDirectory: boolean;
  onClose: () => void; onRename: () => void; onNewFile: () => void; onNewFolder: () => void;
}

export default function FileContextMenu({ x, y, targetPath, isDirectory, onClose, onRename, onNewFile, onNewFolder }: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const { deleteEntry, setSelectedPath } = useFileTreeStore()

  useEffect(() => {
    const handleOutside = (e: globalThis.MouseEvent) => { 
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose() 
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [onClose])

  const handleDelete = useCallback(() => {
    const name = targetPath.split(/[/\\]/).pop() || targetPath
    onClose()

    // 使用 Electron 主进程的 dialog.showMessageBox() 替代 window.confirm()。
    // window.confirm() 是浏览器对话框，会使 BrowserWindow 失去 OS 键盘焦点，
    // 且渲染进程无法自行恢复，导致删除后 IDE 内所有键盘输入全部失效。
    // 通过 IPC 由主进程弹窗，Electron 在对话框关闭后自动归还键盘焦点。
    setTimeout(async () => {
      const confirmed = await window.api.showConfirm(`Delete "${name}"?`)
      if (confirmed) {
        deleteEntry(targetPath)
        setSelectedPath(null)
      }
    }, 150)
  }, [targetPath, deleteEntry, onClose, setSelectedPath])

  const menuItems = [
    { label: 'New File', handler: () => { onNewFile(); onClose(); }, show: isDirectory },
    { label: 'New Folder', handler: () => { onNewFolder(); onClose(); }, show: isDirectory },
    'separator' as const,
    { label: 'Rename', handler: () => { onRename(); onClose(); } },
    { label: 'Delete', handler: handleDelete },
    'separator' as const,
    { label: 'Copy Path', handler: () => { navigator.clipboard.writeText(targetPath); onClose(); } },
  ]

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md shadow-xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, i) => item === 'separator' ? <div key={i} className="my-1 border-t border-[var(--border)]" /> : (item.show !== false && (
        <button key={item.label} onClick={item.handler} className="w-full px-3 py-1.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
          {item.label}
        </button>
      )))}
    </div>
  )
}
