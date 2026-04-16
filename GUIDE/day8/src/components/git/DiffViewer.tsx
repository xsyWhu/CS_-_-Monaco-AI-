/**
 * Day 8: DiffViewer —— Git diff 语法高亮渲染，统一设计语言。
 */

interface Props {
  diff: string
}

export default function DiffViewer({ diff }: Props) {
  if (!diff.trim()) {
    return (
      <div className="px-3 py-6 text-center text-xs text-[var(--color-fg-muted)] select-none">
        当前无未提交改动
      </div>
    )
  }

  const lines = diff.split("\n")

  return (
    <div className="overflow-auto text-xs font-mono leading-5 select-text">
      {lines.map((line, i) => {
        let textClass = "text-[var(--color-fg-secondary)]"
        let bgClass = ""

        if (line.startsWith("+++") || line.startsWith("---")) {
          textClass = "text-[var(--color-fg-primary)] font-bold"
        } else if (line.startsWith("+")) {
          textClass = "text-[var(--color-success)]"
          bgClass = "bg-[rgba(74,222,128,0.08)]"
        } else if (line.startsWith("-")) {
          textClass = "text-[var(--color-error)]"
          bgClass = "bg-[rgba(248,113,113,0.08)]"
        } else if (line.startsWith("@@")) {
          textClass = "text-[var(--color-accent)]"
          bgClass = "bg-[rgba(108,138,255,0.05)]"
        } else if (line.startsWith("diff ") || line.startsWith("index ")) {
          textClass = "text-[var(--color-fg-muted)]"
        }

        return (
          <div key={i} className={`flex items-start px-2 py-px ${bgClass}`}>
            <span className="text-[var(--color-fg-muted)] select-none w-8 text-right mr-3 shrink-0 tabular-nums opacity-50">
              {i + 1}
            </span>
            <span className={textClass}>{line || " "}</span>
          </div>
        )
      })}
    </div>
  )
}
