/**
 * Day 8: Inline Diff 审核视图。
 *
 * 当 Agent 通过 edit_file / write_file 修改文件后，
 * 该组件展示新旧内容的逐行对比，供开发者判断 Accept 或 Reject。
 *
 * 设计：
 * - 顶部工具栏：文件名、工具名称、Accept / Reject 按钮。
 * - 主体：统一 diff 视图，删除行红色背景，新增行绿色背景。
 * - 使用简单的逐行 diff 算法（Longest Common Subsequence 对齐）。
 */

import { useMemo } from "react"
import { Check, X, FileEdit } from "lucide-react"
import { useEditorStore } from "../../stores/editor.store"

/** 单行 diff 类型。 */
type DiffLineType = "unchanged" | "added" | "removed"

interface DiffLine {
  type: DiffLineType
  lineNo: { old: number | null; new: number | null }
  text: string
}

/**
 * 计算两段文本的逐行 diff（简单 LCS 算法）。
 * 对于教程项目规模足够高效。
 */
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")

  // LCS 表
  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        oldLines[i - 1] === newLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // 回溯生成 diff 行
  const result: DiffLine[] = []
  let i = m, j = n
  const stack: DiffLine[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: "unchanged", lineNo: { old: i, new: j }, text: oldLines[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: "added", lineNo: { old: null, new: j }, text: newLines[j - 1] })
      j--
    } else {
      stack.push({ type: "removed", lineNo: { old: i, new: null }, text: oldLines[i - 1] })
      i--
    }
  }

  // 反转（因为回溯是从尾部开始的）
  while (stack.length) result.push(stack.pop()!)
  return result
}

// 行类型对应的样式。
const lineStyles: Record<DiffLineType, string> = {
  unchanged: "",
  added: "bg-[rgba(74,222,128,0.10)]",
  removed: "bg-[rgba(248,113,113,0.10)]",
}

const gutterStyles: Record<DiffLineType, string> = {
  unchanged: "text-[var(--color-fg-muted)]",
  added: "text-[var(--color-success)]",
  removed: "text-[var(--color-error)]",
}

const prefixMap: Record<DiffLineType, string> = {
  unchanged: " ",
  added: "+",
  removed: "-",
}

export default function InlineDiffView() {
  const activeDiff = useEditorStore((s) => s.activeDiff)
  const acceptDiff = useEditorStore((s) => s.acceptDiff)
  const rejectDiff = useEditorStore((s) => s.rejectDiff)

  const diffLines = useMemo(() => {
    if (!activeDiff) return []
    return computeDiff(activeDiff.oldContent, activeDiff.newContent)
  }, [activeDiff])

  if (!activeDiff) return null

  // 提取文件名（从绝对路径中取最后部分）。
  const fileName = activeDiff.filePath.replace(/\\/g, "/").split("/").pop() ?? activeDiff.filePath

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-primary)] animate-fade-in-scale">
      {/* ── 顶部工具栏 ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-2 text-sm">
          <FileEdit size={14} className="text-[var(--color-accent)]" />
          <span className="font-medium text-[var(--color-fg-primary)]">{fileName}</span>
          <span className="text-[var(--color-fg-muted)] text-xs">
            via {activeDiff.toolName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={rejectDiff}
            className="flex items-center gap-1 px-3 py-1 text-xs rounded
                       border border-[var(--color-error)] text-[var(--color-error)]
                       hover:bg-[rgba(248,113,113,0.12)] transition-base cursor-pointer"
          >
            <X size={12} /> Reject
          </button>
          <button
            onClick={acceptDiff}
            className="flex items-center gap-1 px-3 py-1 text-xs rounded
                       bg-[var(--color-success)] text-[var(--color-bg-primary)] font-medium
                       hover:brightness-110 transition-base cursor-pointer"
          >
            <Check size={12} /> Accept
          </button>
        </div>
      </div>

      {/* ── 变更统计 ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 py-1.5 text-xs border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-tertiary)]">
        <span className="text-[var(--color-success)]">
          +{diffLines.filter((l) => l.type === "added").length} 行
        </span>
        <span className="text-[var(--color-error)]">
          -{diffLines.filter((l) => l.type === "removed").length} 行
        </span>
      </div>

      {/* ── Diff 内容 ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto font-mono text-[13px] leading-5">
        {diffLines.map((line, idx) => (
          <div key={idx} className={`flex ${lineStyles[line.type]}`}>
            {/* 旧行号 */}
            <span className={`w-12 text-right pr-2 select-none shrink-0 ${gutterStyles[line.type]}`}>
              {line.lineNo.old ?? ""}
            </span>
            {/* 新行号 */}
            <span className={`w-12 text-right pr-2 select-none shrink-0 ${gutterStyles[line.type]}`}>
              {line.lineNo.new ?? ""}
            </span>
            {/* 前缀 (+/-/空格) */}
            <span className={`w-5 text-center select-none shrink-0 ${gutterStyles[line.type]}`}>
              {prefixMap[line.type]}
            </span>
            {/* 行内容 */}
            <span className="flex-1 pr-4 whitespace-pre">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
