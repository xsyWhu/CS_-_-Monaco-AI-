/**
 * Day 7: DiffViewer —— Git diff 的语法高亮渲染。
 *
 * 规则：
 *   +++ / --- 行 → 加粗文件路径
 *   + 行        → 绿色（新增）
 *   - 行        → 红色（删除）
 *   @@ 行       → 蓝色（行号区段）
 *   diff/index 行 → 灰色（元信息）
 *   其他        → 正常颜色（上下文行）
 */

interface Props {
  diff: string
}

export default function DiffViewer({ diff }: Props) {
  if (!diff.trim()) {
    return (
      <div className="px-3 py-6 text-center text-xs text-gray-500 select-none">
        当前无未提交改动
      </div>
    )
  }

  const lines = diff.split("\n")

  return (
    <div className="overflow-auto text-xs font-mono leading-5 select-text">
      {lines.map((line, i) => {
        let textClass = "text-gray-300"
        let bgClass = ""

        if (line.startsWith("+++") || line.startsWith("---")) {
          textClass = "text-white font-bold"
        } else if (line.startsWith("+")) {
          textClass = "text-green-400"
          bgClass = "bg-green-400/10"
        } else if (line.startsWith("-")) {
          textClass = "text-red-400"
          bgClass = "bg-red-400/10"
        } else if (line.startsWith("@@")) {
          textClass = "text-blue-400"
          bgClass = "bg-blue-400/5"
        } else if (line.startsWith("diff ") || line.startsWith("index ")) {
          textClass = "text-gray-500"
        }

        return (
          <div key={i} className={`flex items-start px-2 py-px ${bgClass}`}>
            {/* 行号 */}
            <span className="text-gray-600 select-none w-8 text-right mr-3 shrink-0 tabular-nums">
              {i + 1}
            </span>
            {/* 行内容 */}
            <span className={textClass}>{line || " "}</span>
          </div>
        )
      })}
    </div>
  )
}
