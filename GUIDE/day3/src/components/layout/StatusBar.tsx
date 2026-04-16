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
    // Day 3 状态栏增加当前文件显示，便于观察文件树联动效果。
    <div className="h-6 bg-blue-600 text-white text-xs flex items-center px-4 shrink-0 transition-colors">
      <span className="font-semibold">Day 3 File System</span>
      <span className="mx-4 opacity-50">|</span>
      <span>{fileLabel}</span>
    </div>
  )
}
