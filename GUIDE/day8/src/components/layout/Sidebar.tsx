/**
 * Day 8: Sidebar 重构——统一活动栏 + 新增 Chat 切换 + 设计语言升级。
 *
 * 结构：
 *   左侧 Activity Bar（图标列）+ 右侧面板内容区。
 * 活动栏按钮：
 *   - Files（文件树）
 *   - Git（源代码管理）
 *   - Chat（切换 AI 对话面板）
 *   - Settings（打开设置对话框）
 */

import { useState } from "react"
import { FolderTree, GitBranch, Settings, MessageSquare, PanelLeftClose } from "lucide-react"
import { useEditorStore } from "../../stores/editor.store"
import FileExplorer from "../file-explorer/FileExplorer"
import GitPanel from "../git/GitPanel"
import SettingsDialog from "../settings/SettingsDialog"

export default function Sidebar() {
  const { activeSidebarPanel, setActiveSidebarPanel, setSidebarOpen, isChatOpen, setChatOpen } = useEditorStore()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const navItems = [
    { id: "files" as const, icon: <FolderTree className="w-[18px] h-[18px]" />, title: "文件资源管理器" },
    { id: "git" as const, icon: <GitBranch className="w-[18px] h-[18px]" />, title: "源代码管理" },
  ]

  return (
    <>
      <div className="h-full flex flex-row bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)]">
        {/* ── Activity Bar ── */}
        <div className="w-11 flex flex-col items-center py-2 gap-0.5 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)]">
          {navItems.map((item) => {
            const active = activeSidebarPanel === item.id
            return (
              <button
                key={item.id}
                title={item.title}
                onClick={() => setActiveSidebarPanel(item.id)}
                className={`relative w-9 h-9 flex items-center justify-center rounded-md cursor-pointer
                  transition-base
                  ${active
                    ? "text-[var(--color-fg-primary)] bg-[var(--color-bg-hover)]"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg-secondary)] hover:bg-[var(--color-bg-hover)]"
                  }`}
              >
                {/* 激活指示条 */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r bg-[var(--color-accent)]" />
                )}
                {item.icon}
              </button>
            )
          })}

          {/* Chat 切换 */}
          <button
            title="切换 AI 对话面板"
            onClick={() => setChatOpen(!isChatOpen)}
            className={`w-9 h-9 flex items-center justify-center rounded-md cursor-pointer transition-base
              ${isChatOpen
                ? "text-[var(--color-accent)] bg-[var(--color-accent-muted)]"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg-secondary)] hover:bg-[var(--color-bg-hover)]"
              }`}
          >
            <MessageSquare className="w-[18px] h-[18px]" />
          </button>

          {/* 弹性空间 + Settings */}
          <div className="flex-1" />
          <button
            title="设置"
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-md cursor-pointer
                       text-[var(--color-fg-muted)] hover:text-[var(--color-fg-secondary)]
                       hover:bg-[var(--color-bg-hover)] transition-base"
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* ── 面板内容区 ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--color-border)] shrink-0">
            <span className="text-[11px] font-semibold text-[var(--color-fg-muted)] uppercase tracking-widest select-none">
              {activeSidebarPanel === "files" ? "资源管理器" : "源代码管理"}
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-0.5 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-fg-muted)]
                         hover:text-[var(--color-fg-secondary)] transition-base cursor-pointer"
              title="收起侧边栏"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
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

