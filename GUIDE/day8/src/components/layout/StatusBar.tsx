import { useMemo } from 'react'
import { useEditorStore } from '../../stores/editor.store'
import { useGitStore } from '../../stores/git.store'

export default function StatusBar() {
  const { openFilePath, pendingDiffs, isSidebarOpen, setSidebarOpen } = useEditorStore()
  const status = useGitStore((s) => s.status)

  const fileLabel = useMemo(() => {
    if (!openFilePath) return '未打开文件'
    const parts = openFilePath.split(/[/\\]/)
    return parts[parts.length - 1]
  }, [openFilePath])

  return (
    <div className="h-6 bg-[var(--color-bg-elevated)] text-[var(--color-fg-secondary)]
                    text-[11px] flex items-center px-3 shrink-0 border-t border-[var(--color-border-subtle)]
                    select-none gap-3">
      {/* 侧边栏切换（当侧边栏隐藏时，可从此处打开） */}
      {!isSidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="hover:text-[var(--color-fg-primary)] transition-base cursor-pointer"
          title="展开侧边栏"
        >
          ☰
        </button>
      )}

      {/* 品牌 */}
      <span className="font-semibold text-[var(--color-accent)]">Day 8</span>
      <span className="opacity-30">|</span>

      {/* Git 分支 */}
      {status?.current && (
        <>
          <span className="opacity-80">⎇ {status.current}</span>
          <span className="opacity-30">|</span>
        </>
      )}

      {/* 当前文件 */}
      <span>{fileLabel}</span>

      {/* 弹性空间 */}
      <div className="flex-1" />

      {/* Pending Diff 数量 */}
      {pendingDiffs.length > 0 && (
        <span className="text-[var(--color-warning)]">
          {pendingDiffs.length} 个待审核变更
        </span>
      )}
    </div>
  )
}

