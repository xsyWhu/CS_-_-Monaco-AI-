import { useMemo } from 'react'
import { useEditorStore } from '../../stores/editor.store'

export default function StatusBar() {
  const { openFilePath } = useEditorStore()

  const fileLabel = useMemo(() => {
    if (!openFilePath) {
      return 'No file opened'
    }

    const parts = openFilePath.split(/[/\\]/)
    return `Opened: ${parts[parts.length - 1]}`
  }, [openFilePath])

  return (
    // Day 6 状态栏：AgentLoop 分离 + write_file 工具 + 状态可视化。
    <div className="h-6 bg-violet-600 text-white text-xs flex items-center px-4 shrink-0 transition-colors">
      <span className="font-semibold">Day 6 AgentLoop</span>
      <span className="mx-4 opacity-50">|</span>
      <span>{fileLabel}</span>
    </div>
  )
}
