/**
 * Day 8: 编辑器区域。
 *
 * 顶部展示 Pending Diff 标签栏（如果有待审核的文件变更），
 * 下方为 Monaco 编辑器（或 InlineDiffView，由 MonacoWrapper 内部切换）。
 */

import { Code2, FileWarning } from 'lucide-react'
import { useEditorStore } from '../../stores/editor.store'
import MonacoWrapper from './MonacoWrapper'

export default function EditorArea() {
  const openFilePath = useEditorStore((s) => s.openFilePath)
  const pendingDiffs = useEditorStore((s) => s.pendingDiffs)
  const activeDiff = useEditorStore((s) => s.activeDiff)
  const reviewDiff = useEditorStore((s) => s.reviewDiff)

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-primary)] overflow-hidden">
      {/* Pending Diff 标签栏 —— 仅在有待审核变更时显示 */}
      {pendingDiffs.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-[var(--color-border)]
                        bg-[var(--color-bg-tertiary)] overflow-x-auto shrink-0 animate-fade-in">
          <FileWarning size={13} className="text-[var(--color-warning)] shrink-0 mr-1" />
          <span className="text-[11px] text-[var(--color-fg-muted)] mr-2 shrink-0">待审核：</span>
          {pendingDiffs.map((diff) => {
            const fileName = diff.filePath.replace(/\\/g, "/").split("/").pop() ?? diff.filePath
            const isActive = activeDiff?.filePath === diff.filePath
            return (
              <button
                key={diff.filePath}
                onClick={() => reviewDiff(diff.filePath)}
                className={`px-2 py-0.5 text-[11px] rounded transition-base cursor-pointer shrink-0
                  ${isActive
                    ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)] border border-[var(--color-accent)]"
                    : "text-[var(--color-fg-secondary)] hover:text-[var(--color-fg-primary)] hover:bg-[var(--color-bg-hover)]"
                  }`}
              >
                {fileName}
              </button>
            )
          })}
        </div>
      )}

      {/* 编辑器主体 */}
      <div className="flex-1 overflow-hidden">
        {!openFilePath && !activeDiff ? (
          /* 空状态 */
          <div className="h-full flex flex-col items-center justify-center text-[var(--color-fg-muted)] select-none gap-3">
            <Code2 size={48} strokeWidth={1} className="opacity-15" />
            <h2 className="text-lg font-light text-[var(--color-fg-secondary)]">Agent IDE</h2>
            <p className="text-xs opacity-50">从左侧文件树选择文件，或通过 AI 助手发送指令</p>
          </div>
        ) : (
          <MonacoWrapper />
        )}
      </div>
    </div>
  )
}
