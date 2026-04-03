import { useState } from 'react'
import { FolderOpen, Search, GitBranch, Settings } from 'lucide-react'
import { useSettingsStore, type SidebarPanel } from '@/stores/settings.store'
import { cn } from '@/lib/utils'
import FileExplorer from '@/components/file-explorer/FileExplorer'
import SearchPanel from '@/components/search/SearchPanel'
import GitPanel from '@/components/git/GitPanel'
import SettingsDialog from '@/components/settings/SettingsDialog'

const activityItems: { id: SidebarPanel; icon: typeof FolderOpen; label: string }[] = [
  { id: 'files', icon: FolderOpen, label: 'Explorer' },
  { id: 'search', icon: Search, label: 'Search' },
  { id: 'git', icon: GitBranch, label: 'Source Control' },
]

function ActivityBarButton({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: typeof FolderOpen
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cn(
        'relative flex items-center justify-center w-10 h-10 transition-colors',
        isActive
          ? 'text-[var(--accent)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-[var(--accent)] rounded-r" />
      )}
      <Icon size={20} strokeWidth={1.5} />
    </button>
  )
}

const panelComponents: Record<SidebarPanel, React.FC> = {
  files: FileExplorer,
  search: SearchPanel,
  git: GitPanel,
}

export default function Sidebar() {
  const activeSidebarPanel = useSettingsStore((s) => s.activeSidebarPanel)
  const setSidebarPanel = useSettingsStore((s) => s.setSidebarPanel)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const ActivePanelContent = panelComponents[activeSidebarPanel]

  return (
    <div className="h-full flex bg-[var(--bg-secondary)]">
      {/* Activity bar */}
      <div className="flex flex-col items-center w-10 shrink-0 border-r border-[var(--border)] py-1">
        {activityItems.map((item) => (
          <ActivityBarButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={activeSidebarPanel === item.id}
            onClick={() => setSidebarPanel(item.id)}
          />
        ))}
        <div className="flex-1" />
        <button
          title="Settings"
          onClick={() => setSettingsOpen(true)}
          className="flex items-center justify-center w-10 h-10 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <Settings size={20} strokeWidth={1.5} />
        </button>
      </div>

      {/* Side panel content */}
      <div className="flex-1 overflow-hidden">
        <ActivePanelContent />
      </div>

      <SettingsDialog isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
