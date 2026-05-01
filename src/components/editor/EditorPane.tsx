import { useEffect, useMemo, useRef, type DragEventHandler } from 'react'
import { useEditorStore, type EditorPane } from '@/stores/editor.store'
import { useSettingsStore } from '@/stores/settings.store'
import EditorTab from './EditorTab'
import MonacoWrapper from './MonacoWrapper'
import { extractOutlineItems } from '@/lib/outline'

interface EditorPaneProps {
  pane: EditorPane
}

export default function EditorPaneView({ pane }: EditorPaneProps) {
  const tabs = useEditorStore((s) => s.tabs)
  const paneTabs = useEditorStore((s) => s.paneTabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const pendingReveal = useEditorStore((s) => s.pendingReveal)
  const clearPendingReveal = useEditorStore((s) => s.clearPendingReveal)
  const updateTabContent = useEditorStore((s) => s.updateTabContent)
  const saveTab = useEditorStore((s) => s.saveTab)
  const saveAllTabs = useEditorStore((s) => s.saveAllTabs)
  const setCursorPosition = useEditorStore((s) => s.setCursorPosition)
  const setTabCursorPosition = useEditorStore((s) => s.setTabCursorPosition)
  const setProblems = useEditorStore((s) => s.setProblems)
  const setOutlineItems = useEditorStore((s) => s.setOutlineItems)
  const setFocusedPane = useEditorStore((s) => s.setFocusedPane)
  const focusedPane = useEditorStore((s) => s.focusedPane)
  const autoSaveMode = useSettingsStore((s) => s.autoSaveMode)
  const autoSaveDelay = useSettingsStore((s) => s.autoSaveDelay)
  const formatOnSave = useSettingsStore((s) => s.formatOnSave)
  const formatDocumentRef = useRef<(() => Promise<void>) | null>(null)

  const paneTabIds = paneTabs[pane]
  const activeTab = tabs.find((tab) => tab.id === paneTabIds[0]) ?? null
  const outlineItems = useMemo(() => {
    if (!activeTab) return []
    return extractOutlineItems(activeTab.fileName, activeTab.language, activeTab.content)
  }, [activeTab?.fileName, activeTab?.language, activeTab?.content])

  const visibleTabs = useMemo(
    () => paneTabIds.map((id) => tabs.find((tab) => tab.id === id)).filter(Boolean) as NonNullable<
      typeof tabs[number]
    >[],
    [paneTabIds, tabs],
  )

  const saveActiveTab = async (tabId: string | null = activeTabId): Promise<void> => {
    if (!tabId) return
    const currentTab = tabs.find((tab) => tab.id === tabId)
    if (!currentTab) return

    if (formatOnSave) {
      await formatDocumentRef.current?.()
    }

    await saveTab(tabId)
  }

  useEffect(() => {
    if (focusedPane === pane) {
      setOutlineItems(outlineItems)
    }
  }, [outlineItems, pane, focusedPane, setOutlineItems])

  useEffect(() => {
    if (autoSaveMode !== 'afterDelay') return
    if (!activeTab || !activeTab.isDirty) return

    const timer = setTimeout(() => {
      void saveActiveTab(activeTab?.id ?? null).catch((error) => {
        console.error('Failed to auto-save active tab:', error)
      })
    }, autoSaveDelay)

    return () => clearTimeout(timer)
  }, [autoSaveMode, autoSaveDelay, activeTab, formatOnSave])

  const handleDrop: DragEventHandler<HTMLDivElement> = async (event) => {
    event.preventDefault()
    setFocusedPane(pane)

    const filePath = event.dataTransfer.getData('text/plain')
    if (filePath) {
      await useEditorStore.getState().openFileInPane(filePath, pane)
    }
  }

  if (!activeTab) {
    return (
      <div
        className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onMouseDown={() => setFocusedPane(pane)}
      >
        <div className="flex items-center overflow-x-auto bg-[var(--bg-secondary)] border-b border-[var(--border)] shrink-0">
          {visibleTabs.map((tab) => (
            <EditorTab key={tab.id} tab={tab} isActive={false} pane={pane} />
          ))}
        </div>
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
          Drop a file here or open one to start editing
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onMouseDown={() => setFocusedPane(pane)}
    >
      <div className="flex items-center overflow-x-auto bg-[var(--bg-secondary)] border-b border-[var(--border)] shrink-0">
        {visibleTabs.map((tab) => (
          <EditorTab key={tab.id} tab={tab} isActive={tab.id === activeTab.id} pane={pane} />
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        <MonacoWrapper
          filePath={activeTab.filePath}
          content={activeTab.content}
          language={activeTab.language}
          revealPosition={
            pendingReveal?.filePath === activeTab.filePath
              ? {
                  line: pendingReveal.line,
                  column: pendingReveal.column,
                  requestId: pendingReveal.requestId,
                }
              : null
          }
          onRevealHandled={clearPendingReveal}
          onChange={(value) => {
            if (value !== undefined) {
              updateTabContent(activeTab.id, value)
            }
          }}
          onSave={() => {
            void saveActiveTab(activeTab?.id ?? null).catch((error) => {
              console.error('Failed to save active tab:', error)
            })
          }}
          onSaveAll={() => {
            void saveAllTabs().catch((error) => {
              console.error('Failed to save all tabs:', error)
            })
          }}
          onBlur={() => {
            if (autoSaveMode === 'onFocusChange' && activeTab?.isDirty) {
              void saveActiveTab(activeTab?.id ?? null).catch((error) => {
                console.error('Failed to auto-save on focus change:', error)
              })
            }
          }}
          onCursorChange={(position) => {
            setCursorPosition(position)
            setTabCursorPosition(activeTab.id, position)
          }}
          onProblemsChange={(problems) => {
            setProblems(problems)
          }}
          onFormatDocumentReady={(formatDocument) => {
            formatDocumentRef.current = formatDocument
          }}
        />
      </div>
    </div>
  )
}
