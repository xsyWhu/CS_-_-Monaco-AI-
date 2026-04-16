import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import Sidebar from './Sidebar'
import StatusBar from './StatusBar'
import { FileCode, TerminalSquare, MessageSquare } from 'lucide-react'
import { useEditorStore } from '../../stores/editor.store'
import MonacoWrapper from '../editor/MonacoWrapper'
import TerminalInstance from '../terminal/TerminalInstance'
import ChatPanel from '../chat/ChatPanel'

export default function AppLayout() {
  // 从全局状态读取侧边栏与 Chat 面板开关。
  const { isSidebarOpen, isChatOpen, setChatOpen } = useEditorStore()

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* 主内容区：活动栏 + 侧边栏 + 主工作区 + Chat 面板 */}
      <div className="flex-1 flex overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* 活动栏：Day 4 聊天图标可切换 Chat 面板。 */}
          <div className="w-12 shrink-0 bg-surface border-r border-border flex flex-col items-center py-2 gap-4">
            <button className="p-2 text-gray-400 hover:text-white rounded cursor-pointer">
              <FileCode size={24} />
            </button>
            <button
              onClick={() => setChatOpen(!isChatOpen)}
              className={`p-2 rounded cursor-pointer ${isChatOpen ? 'text-white bg-[#2a2d2e]' : 'text-gray-400 hover:text-white'}`}
              title="切换 AI 对话面板"
            >
              <MessageSquare size={24} />
            </button>
          </div>

          {/* 可折叠侧边栏（文件树） */}
          {isSidebarOpen && (
            <>
              <Panel defaultSize={20} minSize={15} maxSize={30}>
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-blue-500 transition-colors" />
            </>
          )}

          {/* 主工作区：Monaco + 终端 */}
          <Panel defaultSize={isChatOpen ? 55 : 80}>
            <PanelGroup direction="vertical">
              {/* Day 4: Monaco 展示真实文件内容。 */}
              <Panel defaultSize={70}>
                <div className="h-full bg-background border-b border-border">
                  <MonacoWrapper />
                </div>
              </Panel>
              
              <PanelResizeHandle className="h-1 bg-border hover:bg-blue-500 transition-colors" />
              
              {/* 保留终端 */}
              <Panel defaultSize={30}>
                <div className="h-full flex flex-col bg-surface">
                  <div className="h-8 border-b border-border flex items-center px-4">
                    <TerminalSquare size={14} className="mr-2" />
                    <span className="text-xs uppercase font-semibold">Terminal</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <TerminalInstance />
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          {/* Day 4: 可折叠 Chat 面板 */}
          {isChatOpen && (
            <>
              <PanelResizeHandle className="w-1 bg-border hover:bg-blue-500 transition-colors" />
              <Panel defaultSize={25} minSize={20} maxSize={40}>
                <ChatPanel />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {/* 状态栏固定在底部。 */}
      <StatusBar />
    </div>
  )
}
