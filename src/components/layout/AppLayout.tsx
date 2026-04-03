import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useSettingsStore } from '@/stores/settings.store'
import Sidebar from './Sidebar'
import StatusBar from './StatusBar'
import EditorArea from '@/components/editor/EditorArea'
import TerminalPanel from '@/components/terminal/TerminalPanel'
import ChatPanel from '@/components/chat/ChatPanel'

function ResizeHandle({ direction = 'horizontal' }: { direction?: 'horizontal' | 'vertical' }) {
  const isHorizontal = direction === 'horizontal'
  return (
    <PanelResizeHandle
      className={`
        ${isHorizontal ? 'w-[2px]' : 'h-[2px]'}
        bg-[var(--border)] hover:bg-[var(--accent)] transition-colors duration-150
      `}
    />
  )
}

export default function AppLayout() {
  const sidebarVisible = useSettingsStore((s) => s.sidebarVisible)
  const chatVisible = useSettingsStore((s) => s.chatVisible)
  const terminalVisible = useSettingsStore((s) => s.terminalVisible)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Title bar for Electron frameless window */}
      <div className="titlebar-drag h-8 flex items-center justify-between px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] shrink-0 select-none">
        <span className="text-xs text-[var(--text-muted)] font-medium tracking-wide">
          Agent IDE
        </span>
        <div className="titlebar-no-drag flex items-center gap-1 text-[var(--text-muted)] text-xs">
          <span className="opacity-50">⎯</span>
          <span className="opacity-50">☐</span>
          <span className="opacity-50">✕</span>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" autoSaveId="main-layout">
          {/* Sidebar */}
          {sidebarVisible && (
            <>
              <Panel
                id="sidebar"
                order={1}
                defaultSize={18}
                minSize={12}
                maxSize={35}
              >
                <Sidebar />
              </Panel>
              <ResizeHandle />
            </>
          )}

          {/* Center area: editor + terminal */}
          <Panel id="center" order={2} minSize={30}>
            <PanelGroup direction="vertical" autoSaveId="center-layout">
              <Panel id="editor" order={1} minSize={30}>
                <EditorArea />
              </Panel>

              {terminalVisible && (
                <>
                  <ResizeHandle direction="vertical" />
                  <Panel
                    id="terminal"
                    order={2}
                    defaultSize={30}
                    minSize={10}
                    maxSize={70}
                  >
                    <TerminalPanel />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {/* Chat panel */}
          {chatVisible && (
            <>
              <ResizeHandle />
              <Panel
                id="chat"
                order={3}
                defaultSize={25}
                minSize={15}
                maxSize={45}
              >
                <ChatPanel />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  )
}
