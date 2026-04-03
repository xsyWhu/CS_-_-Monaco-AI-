import { useEditorStore } from '@/stores/editor.store'
import EditorTab from './EditorTab'
import MonacoWrapper from './MonacoWrapper'
import { Code2 } from 'lucide-react'

export default function EditorArea() {
  const tabs = useEditorStore((s) => s.tabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const updateTabContent = useEditorStore((s) => s.updateTabContent)

  const activeTab = tabs.find((t) => t.id === activeTabId)

  if (tabs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)] select-none">
        <Code2 size={48} strokeWidth={1} className="mb-4 opacity-30" />
        <h2 className="text-xl font-light mb-2 text-[var(--text-secondary)]">
          Agent IDE
        </h2>
        <p className="text-sm">Open a folder to get started</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center overflow-x-auto bg-[var(--bg-secondary)] border-b border-[var(--border)] shrink-0">
        {tabs.map((tab) => (
          <EditorTab
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
          />
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {activeTab && (
          <MonacoWrapper
            filePath={activeTab.filePath}
            content={activeTab.content}
            language={activeTab.language}
            onChange={(value) => {
              if (value !== undefined) {
                updateTabContent(activeTab.id, value)
              }
            }}
          />
        )}
      </div>
    </div>
  )
}
