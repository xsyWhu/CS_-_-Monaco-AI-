/**
 * Day 7: Sidebar 重构——支持多面板切换（文件 / Git）和设置入口。
 *
 * 结构：
 *   左侧 Activity Bar（图标列）+ 右侧面板内容区。
 * 活动栏按钮：
 *   - Files（文件树）
 *   - Git（源代码管理）
 *   - Settings（打开设置对话框）
 */

import { useState } from "react"
import { FolderTree, GitBranch, Settings, X } from "lucide-react"
import { useEditorStore } from "../../stores/editor.store"
import FileExplorer from "../file-explorer/FileExplorer"
import GitPanel from "../git/GitPanel"
import SettingsDialog from "../settings/SettingsDialog"

export default function Sidebar() {
  const { activeSidebarPanel, setActiveSidebarPanel, setSidebarOpen } = useEditorStore()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const navItems = [
    { id: "files" as const, icon: <FolderTree className="w-5 h-5" />, title: "文件资源管理器" },
    { id: "git" as const, icon: <GitBranch className="w-5 h-5" />, title: "源代码管理" },
  ]

  return (
    <>
      <div className="h-full flex flex-row bg-gray-900 border-r border-gray-700">
        {/* ── Activity Bar ── */}
        <div className="w-10 flex flex-col items-center py-2 gap-1 border-r border-gray-700 bg-gray-950">
          {navItems.map((item) => {
            const active = activeSidebarPanel === item.id
            return (
              <button
                key={item.id}
                title={item.title}
                onClick={() => setActiveSidebarPanel(item.id)}
                className={[
                  "w-8 h-8 flex items-center justify-center rounded",
                  "hover:bg-gray-700 transition-colors",
                  active
                    ? "text-white border-l-2 border-amber-500 pl-px"
                    : "text-gray-500 hover:text-gray-300",
                ].join(" ")}
              >
                {item.icon}
              </button>
            )
          })}

          {/* Settings 放到底部 */}
          <div className="flex-1" />
          <button
            title="设置"
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* ── 面板内容区 ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700 shrink-0">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide select-none">
              {activeSidebarPanel === "files" ? "资源管理器" : "源代码管理"}
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-0.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 面板主体 */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeSidebarPanel === "files" ? <FileExplorer /> : <GitPanel />}
          </div>
        </div>
      </div>

      {/* Settings 模态框 */}
      <SettingsDialog isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}

