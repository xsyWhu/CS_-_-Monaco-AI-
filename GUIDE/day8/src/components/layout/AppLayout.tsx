/**
 * Day 8: 重构后的应用布局。
 *
 * 变更：
 * - 移除重复的活动栏（由 Sidebar.tsx 内部统一管理）。
 * - 使用新设计系统的 CSS 变量。
 * - 终端面板标题美化。
 * - PanelResizeHandle 使用更精细的样式。
 */

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import Sidebar from './Sidebar'
import StatusBar from './StatusBar'
import { TerminalSquare } from 'lucide-react'
import { useEditorStore } from '../../stores/editor.store'
import MonacoWrapper from '../editor/MonacoWrapper'
import EditorArea from '../editor/EditorArea'
import TerminalInstance from '../terminal/TerminalInstance'
import ChatPanel from '../chat/ChatPanel'

export default function AppLayout() {
  const { isSidebarOpen, isChatOpen, pendingDiffs } = useEditorStore()

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg-primary)] text-[var(--color-fg-primary)]">
      {/* 主内容区：侧边栏（含活动栏）+ 主工作区 + Chat 面板 */}
      <div className="flex-1 flex overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* 侧边栏（含活动栏 + 文件树/Git 面板） */}
          {isSidebarOpen && (
            <>
              <Panel defaultSize={18} minSize={14} maxSize={28}>
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="w-[3px] bg-[var(--color-border-subtle)] hover:bg-[var(--color-accent)] transition-all duration-200" />
            </>
          )}

          {/* 主工作区：编辑器 + 终端 */}
          <Panel defaultSize={isChatOpen ? 57 : 82}>
            <PanelGroup direction="vertical">
              {/* 编辑器区域（含 Pending Diff 标签栏 + Monaco/DiffView） */}
              <Panel defaultSize={70}>
                <EditorArea />
              </Panel>

              <PanelResizeHandle className="h-[3px] bg-[var(--color-border-subtle)] hover:bg-[var(--color-accent)] transition-all duration-200" />

              {/* 终端面板 */}
              <Panel defaultSize={30}>
                <div className="h-full flex flex-col bg-[var(--color-bg-secondary)]">
                  <div className="h-9 border-b border-[var(--color-border)] flex items-center px-4 gap-2">
                    <TerminalSquare size={14} className="text-[var(--color-fg-muted)]" />
                    <span className="text-xs uppercase font-semibold tracking-wider text-[var(--color-fg-secondary)]">
                      Terminal
                    </span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <TerminalInstance />
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          {/* Chat 面板（可折叠） */}
          {isChatOpen && (
            <>
              <PanelResizeHandle className="w-[3px] bg-[var(--color-border-subtle)] hover:bg-[var(--color-accent)] transition-all duration-200" />
              <Panel defaultSize={25} minSize={20} maxSize={40}>
                <ChatPanel />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {/* 底部状态栏 */}
      <StatusBar />
    </div>
  )
}
