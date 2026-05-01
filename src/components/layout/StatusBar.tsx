import { GitBranch } from 'lucide-react'
import { useFileTreeStore } from '@/stores/file-tree.store'
import { useEditorStore } from '@/stores/editor.store'
import { useGitStore } from '@/stores/git.store'

export default function StatusBar() {
  const rootPath = useFileTreeStore((s) => s.rootPath)
  const tabs = useEditorStore((s) => s.tabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const cursorPosition = useEditorStore((s) => s.cursorPosition)
  const saveAllTabs = useEditorStore((s) => s.saveAllTabs)
  const splitEnabled = useEditorStore((s) => s.splitEnabled)
  const toggleSplitView = useEditorStore((s) => s.toggleSplitView)
  const gitStatus = useGitStore((s) => s.status)

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null
  const dirtyCount = tabs.filter((t) => t.isDirty).length
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
        {dirtyCount > 0 && (
          <button
            onClick={() => {
              void saveAllTabs()
            }}
            className="px-1.5 py-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--accent)] transition-colors"
            title="Save all files"
            >
              Save All ({dirtyCount})
            </button>
        )}
        <button
          onClick={toggleSplitView}
          className="px-1.5 py-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--accent)] transition-colors"
          title={splitEnabled ? 'Disable split view' : 'Enable split view'}
        >
          {splitEnabled ? 'Single Pane' : 'Split View'}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
        <span>UTF-8</span>
      </div>
    </div>
  )
}
