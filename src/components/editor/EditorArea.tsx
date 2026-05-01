import { useEditorStore } from '@/stores/editor.store'
import { disposeMonacoModel } from './MonacoWrapper'
import { Code2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import EditorPaneView from './EditorPane'

export default function EditorArea() {
  const tabs = useEditorStore((s) => s.tabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const splitEnabled = useEditorStore((s) => s.splitEnabled)
  const paneTabs = useEditorStore((s) => s.paneTabs)
  const toggleSplitView = useEditorStore((s) => s.toggleSplitView)
  const focusedPane = useEditorStore((s) => s.focusedPane)
  const saveAllTabs = useEditorStore((s) => s.saveAllTabs)
  const saveTab = useEditorStore((s) => s.saveTab)
  const closeTab = useEditorStore((s) => s.closeTab)
  const reopenClosedTab = useEditorStore((s) => s.reopenClosedTab)
  const tabPathsRef = useRef<string[]>([])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 's') {
        const target = event.target as HTMLElement | null
        if (target?.closest?.('.monaco-editor')) return
        event.preventDefault()
        void saveAllTabs().catch((error) => {
          console.error('Failed to save all tabs:', error)
        })
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        const target = event.target as HTMLElement | null
        if (target?.closest?.('.monaco-editor')) return
        event.preventDefault()
        if (activeTabId) {
          void saveTab(activeTabId).catch((error) => {
            console.error('Failed to save active tab:', error)
          })
        }
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
        event.preventDefault()
        if (activeTabId) {
          void closeTab(activeTabId)
        }
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Tab') {
        event.preventDefault()
        const currentPaneTabs = paneTabs[focusedPane]
        if (currentPaneTabs.length <= 1 || !activeTabId) return
        const index = currentPaneTabs.findIndex((id) => id === activeTabId)
        if (index < 0) return
        const nextIndex = event.shiftKey
          ? (index - 1 + currentPaneTabs.length) % currentPaneTabs.length
          : (index + 1) % currentPaneTabs.length
        useEditorStore.getState().setActiveTab(currentPaneTabs[nextIndex])
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
        event.preventDefault()
        toggleSplitView()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault()
        void reopenClosedTab()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTabId, closeTab, focusedPane, paneTabs, reopenClosedTab, saveAllTabs, saveTab, toggleSplitView])

  useEffect(() => {
    const prevPaths = tabPathsRef.current
    const currentPaths = tabs.map((t) => t.filePath)
    const currentSet = new Set(currentPaths)

    for (const prevPath of prevPaths) {
      if (!currentSet.has(prevPath)) {
        disposeMonacoModel(prevPath)
      }
    }

    tabPathsRef.current = currentPaths
  }, [tabs])

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
      {splitEnabled ? (
        <PanelGroup direction="horizontal" autoSaveId="editor-split-layout">
          <Panel id="left-pane" order={1} minSize={20}>
            <EditorPaneView pane="left" />
          </Panel>
          <PanelResizeHandle className="w-[2px] bg-[var(--border)] hover:bg-[var(--accent)] transition-colors duration-150" />
          <Panel id="right-pane" order={2} minSize={20}>
            <EditorPaneView pane="right" />
          </Panel>
        </PanelGroup>
      ) : (
        <EditorPaneView pane="left" />
      )}
    </div>
  )
}
