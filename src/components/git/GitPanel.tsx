import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  GitBranch,
  RefreshCw,
  Plus,
  Minus,
  Check,
  ChevronDown,
  FolderOpen,
  AlertCircle,
  ExternalLink,
  Upload,
  Download,
  Undo2,
  Trash2,
} from 'lucide-react'
import { useGitStore } from '@/stores/git.store'
import { useFileTreeStore } from '@/stores/file-tree.store'
import { useEditorStore } from '@/stores/editor.store'
import GitDiffEditor from './GitDiffEditor'

function joinPath(base: string, relative: string): string {
  const sep = base.includes('\\') ? '\\' : '/'
  return `${base.replace(/[\\/]+$/, '')}${sep}${relative.replace(/^[\\/]+/, '')}`
}

export default function GitPanel() {
  const rootPath = useFileTreeStore((s) => s.rootPath)
  const status = useGitStore((s) => s.status)
  const branches = useGitStore((s) => s.branches)
  const loading = useGitStore((s) => s.loading)
  const refreshStatus = useGitStore((s) => s.refreshStatus)
  const refreshBranches = useGitStore((s) => s.refreshBranches)
  const stageFiles = useGitStore((s) => s.stageFiles)
  const unstageFiles = useGitStore((s) => s.unstageFiles)
  const discardFiles = useGitStore((s) => s.discardFiles)
  const commitFn = useGitStore((s) => s.commit)
  const checkoutFn = useGitStore((s) => s.checkout)
  const pullFn = useGitStore((s) => s.pull)
  const pushFn = useGitStore((s) => s.push)
  const openFile = useEditorStore((s) => s.openFile)

  const [commitMessage, setCommitMessage] = useState('')
  const [showBranches, setShowBranches] = useState(false)
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!rootPath) return
    await Promise.all([refreshStatus(rootPath), refreshBranches(rootPath)])
  }, [rootPath, refreshStatus, refreshBranches])

  useEffect(() => {
    refresh()
  }, [refresh])

  const stagedFiles = useMemo(
    () => (status?.files ?? []).filter((f) => f.index !== ' ' && f.index !== '?'),
    [status],
  )

  const changedFiles = useMemo(
    () => (status?.files ?? []).filter((f) => f.working_dir !== ' ' || f.index === '?'),
    [status],
  )

  const handleStage = async (files: string[]) => {
    if (!rootPath) return
    setBusyAction('stage')
    try {
      await stageFiles(rootPath, files)
      await refreshStatus(rootPath)
    } finally {
      setBusyAction(null)
    }
  }

  const handleUnstage = async (files: string[]) => {
    if (!rootPath) return
    setBusyAction('unstage')
    try {
      await unstageFiles(rootPath, files)
      await refreshStatus(rootPath)
    } finally {
      setBusyAction(null)
    }
  }

  const handleDiscard = async (files: string[]) => {
    if (!rootPath) return
    const confirmed = await window.api.showConfirm(
      `Discard local changes in ${files.length} file${files.length > 1 ? 's' : ''}? This cannot be undone.`,
    )
    if (!confirmed) return

    setBusyAction('discard')
    try {
      await discardFiles(rootPath, files)
      setSelectedDiffFile((current) => (current && files.includes(current) ? null : current))
      await refreshStatus(rootPath)
    } finally {
      setBusyAction(null)
    }
  }

  const handleCommit = async () => {
    if (!rootPath || !commitMessage.trim() || stagedFiles.length === 0) return
    setBusyAction('commit')
    try {
      await commitFn(rootPath, commitMessage.trim())
      setCommitMessage('')
      await refresh()
    } finally {
      setBusyAction(null)
    }
  }

  const handleCheckout = async (branch: string) => {
    if (!rootPath) return
    setBusyAction('checkout')
    try {
      await checkoutFn(rootPath, branch)
      setShowBranches(false)
      await refresh()
    } finally {
      setBusyAction(null)
    }
  }

  const handleOpenFile = async (relativePath: string) => {
    if (!rootPath) return
    const filePath = joinPath(rootPath, relativePath)
    await openFile(filePath)
  }

  const handleViewDiff = async (filePath?: string) => {
    setSelectedDiffFile(filePath ?? null)
  }

  const handlePull = async () => {
    if (!rootPath) return
    setBusyAction('pull')
    try {
      await pullFn(rootPath)
      await refresh()
    } finally {
      setBusyAction(null)
    }
  }

  const handlePush = async () => {
    if (!rootPath) return
    setBusyAction('push')
    try {
      await pushFn(rootPath)
      await refresh()
    } finally {
      setBusyAction(null)
    }
  }

  if (!rootPath) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-[var(--text-muted)]">
        <div className="text-center">
          <FolderOpen size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Open a folder to view Git status</p>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-[var(--text-muted)]">
        <div className="text-center">
          <AlertCircle size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Not a Git repository</p>
          <p className="text-xs mt-1 opacity-60">Initialize a repo or open a Git project</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between px-3 h-10 min-h-10 border-b border-[var(--border)]">
        <div className="relative flex items-center gap-2">
          <GitBranch size={14} className="text-[var(--accent)]" />
          <button
            onClick={() => setShowBranches(!showBranches)}
            className="flex items-center gap-1 text-xs text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
          >
            <span className="truncate max-w-[120px]">{status.current || 'HEAD'}</span>
            <ChevronDown size={12} />
          </button>

          {showBranches && (
            <div className="absolute top-full left-0 mt-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md shadow-lg z-20 min-w-[180px] py-1 max-h-[200px] overflow-y-auto">
              {branches.map((b) => (
                <button
                  key={b.name}
                  onClick={() => handleCheckout(b.name)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-1.5 ${
                    b.current ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {b.current && <Check size={10} className="flex-shrink-0" />}
                  <span className="truncate">{b.name}</span>
                </button>
              ))}
              {branches.length === 0 && (
                <p className="px-3 py-1.5 text-xs text-[var(--text-muted)]">No branches</p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={refresh}
          disabled={loading || busyAction !== null}
          className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 border-b border-[var(--border)]">
        <button
          onClick={() => void handlePull()}
          disabled={loading || busyAction !== null}
          className="flex items-center justify-center gap-1.5 py-1.5 rounded text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Pull from remote"
        >
          <Download size={13} />
          Pull{status.behind > 0 ? ` (${status.behind})` : ''}
        </button>
        <button
          onClick={() => void handlePush()}
          disabled={loading || busyAction !== null}
          className="flex items-center justify-center gap-1.5 py-1.5 rounded text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Push to remote"
        >
          <Upload size={13} />
          Push{status.ahead > 0 ? ` (${status.ahead})` : ''}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <section>
          <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-secondary)] sticky top-0 z-10">
            <div className="sidebar-group-title">Staged Changes ({stagedFiles.length})</div>
            {stagedFiles.length > 0 && (
              <button
                onClick={() => void handleUnstage(stagedFiles.map((f) => f.path))}
                disabled={busyAction !== null}
                className="text-[var(--accent)] hover:text-[var(--accent-hover)] disabled:opacity-40 transition-colors"
                title="Unstage all"
              >
                <Undo2 size={14} />
              </button>
            )}
          </div>
          {stagedFiles.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--text-muted)]">No staged changes</p>
          ) : (
            stagedFiles.map((f) => (
              <div
                key={`staged-${f.path}`}
                className="sidebar-item group text-xs"
                style={{ padding: '0 12px' }}
              >
                <StatusBadge status={f.index} />
                <span
                  className="flex-1 sidebar-truncate text-[var(--text-primary)] cursor-pointer hover:underline"
                  onClick={() => handleViewDiff(f.path)}
                  title={f.path}
                >
                  {f.path}
                </span>
                <button
                  onClick={() => void handleOpenFile(f.path)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                  title="Open in editor"
                >
                  <ExternalLink size={12} />
                </button>
                <button
                  onClick={() => handleViewDiff(f.path)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                  title="View diff"
                >
                  <Minus size={12} />
                </button>
                <button
                  onClick={() => void handleUnstage([f.path])}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                  title="Unstage"
                >
                  <Undo2 size={12} />
                </button>
              </div>
            ))
          )}
        </section>

        <section>
          <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-secondary)] sticky top-0 z-10">
            <div className="sidebar-group-title">Changes ({changedFiles.length})</div>
            {changedFiles.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleStage(changedFiles.map((f) => f.path))}
                  disabled={busyAction !== null}
                  className="text-[var(--accent)] hover:text-[var(--accent-hover)] disabled:opacity-40 transition-colors"
                  title="Stage all"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={() => void handleDiscard(changedFiles.map((f) => f.path))}
                  disabled={busyAction !== null}
                  className="text-[var(--error)] hover:text-[var(--error)] disabled:opacity-40 transition-colors"
                  title="Discard all changes"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
          {changedFiles.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--text-muted)]">No changes</p>
          ) : (
            changedFiles.map((f) => (
              <div
                key={`changed-${f.path}`}
                className="sidebar-item group text-xs"
                style={{ padding: '0 12px' }}
              >
                <StatusBadge status={f.index === '?' ? '?' : f.working_dir} />
                <span
                  className="flex-1 sidebar-truncate text-[var(--text-primary)] cursor-pointer hover:underline"
                  onClick={() => handleViewDiff(f.path)}
                  title={f.path}
                >
                  {f.path}
                </span>
                <button
                  onClick={() => void handleOpenFile(f.path)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                  title="Open in editor"
                >
                  <ExternalLink size={12} />
                </button>
                <button
                  onClick={() => void handleStage([f.path])}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                  title="Stage"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => void handleDiscard([f.path])}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--error)]"
                  title="Discard changes"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </section>

        {selectedDiffFile && (
          <section className="border-t border-[var(--border)]">
            <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              <span>Diff: {selectedDiffFile}</span>
              <button
                onClick={() => setSelectedDiffFile(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm leading-none"
              >
                ×
              </button>
            </div>
            <GitDiffEditor repoPath={rootPath} filePath={selectedDiffFile} />
          </section>
        )}
      </div>

      <div className="p-3 border-t border-[var(--border)] space-y-2">
        <input
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message"
          className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && commitMessage.trim()) void handleCommit()
          }}
        />
        <button
          onClick={handleCommit}
          disabled={!commitMessage.trim() || stagedFiles.length === 0 || loading || busyAction !== null}
          className="w-full py-1.5 rounded text-sm font-medium bg-[var(--accent)] text-[var(--bg-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {busyAction === 'commit' ? 'Committing...' : `Commit${stagedFiles.length > 0 ? ` (${stagedFiles.length})` : ''}`}
        </button>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    M: 'text-[var(--warning)]',
    A: 'text-[var(--success)]',
    D: 'text-[var(--error)]',
    R: 'text-[var(--accent)]',
    C: 'text-[var(--accent)]',
    '?': 'text-[var(--text-muted)]',
  }

  const labelMap: Record<string, string> = {
    M: 'M',
    A: 'A',
    D: 'D',
    R: 'R',
    C: 'C',
    '?': 'U',
  }

  return (
    <span
      className={`font-mono text-[10px] font-bold w-4 text-center flex-shrink-0 ${colorMap[status] || 'text-[var(--text-muted)]'}`}
      title={
        { M: 'Modified', A: 'Added', D: 'Deleted', R: 'Renamed', C: 'Copied', '?': 'Untracked' }[
          status
        ] || status
      }
    >
      {labelMap[status] || status}
    </span>
  )
}
