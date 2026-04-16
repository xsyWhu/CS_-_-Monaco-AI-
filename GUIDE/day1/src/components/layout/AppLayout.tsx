import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import Sidebar from './Sidebar'
import StatusBar from './StatusBar'
import { FileCode, TerminalSquare, MessageSquare } from 'lucide-react'
import { useEditorStore } from '../../stores/editor.store'

export default function AppLayout() {
  // 从全局状态读取侧边栏开关。
  const { isSidebarOpen } = useEditorStore()

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* 主内容区：活动栏 + 侧边栏 + 主工作区 */}
      <div className="flex-1 flex overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* 活动栏：Day 1 仅展示图标，不绑定实际功能。 */}
          <div className="w-12 shrink-0 bg-surface border-r border-border flex flex-col items-center py-2 gap-4">
            <button className="p-2 text-gray-400 hover:text-white rounded cursor-pointer">
              <FileCode size={24} />
            </button>
            <button className="p-2 text-gray-400 hover:text-white rounded cursor-pointer">
              <MessageSquare size={24} />
            </button>
          </div>

          {/* 可折叠侧边栏：通过 Zustand 状态控制是否渲染。 */}
          {isSidebarOpen && (
            <>
              <Panel defaultSize={20} minSize={15} maxSize={30}>
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-blue-500 transition-colors" />
            </>
          )}

          {/* 主工作区：上方编辑区占位 + 下方终端占位。 */}
          <Panel defaultSize={80}>
            <PanelGroup direction="vertical">
              {/* 编辑区占位：Day 2 将替换为 Monaco。 */}
              <Panel defaultSize={70}>
                <div className="h-full flex items-center justify-center bg-background border-b border-border">
                  <p className="text-gray-500 italic">Day 1: Monaco Editor Will Be Here</p>
                </div>
              </Panel>
              
              <PanelResizeHandle className="h-1 bg-border hover:bg-blue-500 transition-colors" />
              
              {/* 终端占位：Day 2 将替换为 xterm.js。 */}
              <Panel defaultSize={30}>
                <div className="h-full flex flex-col bg-surface">
                  <div className="h-8 border-b border-border flex items-center px-4">
                    <TerminalSquare size={14} className="mr-2" />
                    <span className="text-xs uppercase font-semibold">Terminal</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-500 italic">Day 1: Xterm.js Will Be Here</p>
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      {/* 状态栏固定在底部。 */}
      <StatusBar />
    </div>
  )
}
