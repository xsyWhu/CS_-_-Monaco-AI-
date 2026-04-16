import { useMemo } from 'react'
import { useEditorStore } from '../../stores/editor.store'
import { useGitStore } from '../../stores/git.store'

export default function StatusBar() {
  const { openFilePath } = useEditorStore()
  const status = useGitStore((s) => s.status)

  const fileLabel = useMemo(() => {
    if (!openFilePath) return 'No file opened'
    const parts = openFilePath.split(/[/\\]/)
    return `Opened: ${parts[parts.length - 1]}`
  }, [openFilePath])

  return (
    // Day 7 状态栏：高级工具 + Git 集成 + 设置面板
    <div className="h-6 bg-amber-600 text-white text-xs flex items-center px-4 shrink-0 transition-colors">
      <span className="font-semibold">Day 7 Advanced Tools + Git</span>
      <span className="mx-4 opacity-50">|</span>
      {status?.current && (
        <>
          <span className="opacity-80">⎇ {status.current}</span>
          <span className="mx-4 opacity-50">|</span>
        </>
      )}
      <span>{fileLabel}</span>
    </div>
  )
}

