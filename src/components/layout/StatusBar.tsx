import { GitBranch } from 'lucide-react'
import { useFileTreeStore } from '@/stores/file-tree.store'
import { useEditorStore } from '@/stores/editor.store'
import { useGitStore } from '@/stores/git.store'

export default function StatusBar() {
  const rootPath = useFileTreeStore((s) => s.rootPath)
  const tabs = useEditorStore((s) => s.tabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const gitStatus = useGitStore((s) => s.status)

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null
  const currentBranch = gitStatus?.current ?? null
  const folderName = rootPath ? rootPath.split(/[\\/]/).pop() : null

  return (
    <div className="h-6 flex items-center justify-between px-3 bg-[var(--bg-secondary)] border-t border-[var(--border)] text-[var(--text-muted)] text-xs shrink-0 select-none">
      <div className="flex items-center gap-3">
        {folderName && (
          <span className="truncate max-w-[200px]">{folderName}</span>
        )}
        {currentBranch && (
          <span className="flex items-center gap-1">
            <GitBranch size={12} />
            {currentBranch}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {activeTab && (
          <span className="capitalize">{activeTab.language}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span>Ln 1, Col 1</span>
        <span>UTF-8</span>
      </div>
    </div>
  )
}
