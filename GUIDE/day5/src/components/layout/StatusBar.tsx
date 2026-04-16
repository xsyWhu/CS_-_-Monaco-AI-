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
    // Day 5 状态栏：显示阶段 + 打开文件 + 工具箱状态。
    <div className="h-6 bg-blue-600 text-white text-xs flex items-center px-4 shrink-0 transition-colors">
      <span className="font-semibold">Day 5 Agent + Tools</span>
      <span className="mx-4 opacity-50">|</span>
      <span>{fileLabel}</span>
    </div>
  )
}
