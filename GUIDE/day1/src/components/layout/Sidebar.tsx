import { useEditorStore } from '../../stores/editor.store'
import { FolderTree, X } from 'lucide-react'

export default function Sidebar() {
  // 仅取出写操作函数，避免不必要状态订阅。
  const { setSidebarOpen } = useEditorStore()

  return (
    <div className="h-full bg-surface border-r border-border flex flex-col">
      <div className="px-4 py-2 flex items-center justify-between uppercase text-xs font-semibold text-gray-400 border-b border-border">
        <span className="flex items-center"><FolderTree size={14} className="mr-2" />Explorer</span>
        {/* 关闭按钮将触发全局状态更新，从而让侧边栏整体卸载。 */}
        <button onClick={() => setSidebarOpen(false)} className="hover:text-white cursor-pointer"><X size={14} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-gray-500 italic text-sm">Day 1: File Tree Will Be Here</p>
      </div>
    </div>
  )
}
