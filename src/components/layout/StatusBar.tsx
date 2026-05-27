import { GitBranch, MoonStar, Plus, Minus, SunMedium } from 'lucide-react'
import { useFileTreeStore } from '@/stores/file-tree.store'
import { useEditorStore } from '@/stores/editor.store'
import { useGitStore } from '@/stores/git.store'
import { useSettingsStore } from '@/stores/settings.store'
import { saveAllTabs, toggleSplitView } from '@/services/editor/editor-service'

export default function StatusBar() {
  const rootPath = useFileTreeStore((s) => s.rootPath)
  const tabs = useEditorStore((s) => s.tabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const cursorPosition = useEditorStore((s) => s.cursorPosition)
  const splitEnabled = useEditorStore((s) => s.splitEnabled)
  const gitStatus = useGitStore((s) => s.status)
  const themeMode = useSettingsStore((s) => s.themeMode)
  const uiFontSize = useSettingsStore((s) => s.uiFontSize)
  const toggleThemeMode = useSettingsStore((s) => s.toggleThemeMode)
  const setUIFontSize = useSettingsStore((s) => s.setUIFontSize)

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null
  const dirtyCount = tabs.filter((t) => t.isDirty).length
  const currentBranch = gitStatus?.current ?? null
  const folderName = rootPath ? rootPath.split(/[\\/]/).pop() : null

  return (
    <div className="h-7 flex items-center justify-between px-3 bg-[var(--bg-secondary)] border-t border-[var(--border)] text-[var(--text-muted)] text-xs shrink-0 select-none">
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
        <div className="flex items-center gap-1">
          <button
            onClick={() => setUIFontSize(uiFontSize - 1)}
            className="px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Decrease global font size"
          >
            <Minus size={12} />
          </button>
          <span className="min-w-[48px] text-center text-[var(--text-secondary)]">{uiFontSize}px</span>
          <button
            onClick={() => setUIFontSize(uiFontSize + 1)}
            className="px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Increase global font size"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={toggleThemeMode}
            className="px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {themeMode === 'dark' ? <MoonStar size={12} /> : <SunMedium size={12} />}
          </button>
        </div>
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
