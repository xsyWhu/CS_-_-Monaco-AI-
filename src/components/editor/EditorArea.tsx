import { useEditorStore } from '@/stores/editor.store'
import EditorTab from './EditorTab'
import MonacoWrapper, { disposeMonacoModel } from './MonacoWrapper'
import { Code2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useSettingsStore } from '@/stores/settings.store'

export default function EditorArea() {
  const tabs = useEditorStore((s) => s.tabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const pendingReveal = useEditorStore((s) => s.pendingReveal)
  const clearPendingReveal = useEditorStore((s) => s.clearPendingReveal)
  const updateTabContent = useEditorStore((s) => s.updateTabContent)
  const saveTab = useEditorStore((s) => s.saveTab)
  const saveAllTabs = useEditorStore((s) => s.saveAllTabs)
  const setCursorPosition = useEditorStore((s) => s.setCursorPosition)
  const setProblems = useEditorStore((s) => s.setProblems)
  const closeTab = useEditorStore((s) => s.closeTab)
  const setActiveTab = useEditorStore((s) => s.setActiveTab)
  const autoSaveMode = useSettingsStore((s) => s.autoSaveMode)
  const autoSaveDelay = useSettingsStore((s) => s.autoSaveDelay)
  const formatOnSave = useSettingsStore((s) => s.formatOnSave)
  const tabPathsRef = useRef<string[]>([])
  const formatDocumentRef = useRef<(() => Promise<void>) | null>(null)

  const activeTab = tabs.find((t) => t.id === activeTabId)

  const saveActiveTab = async (): Promise<void> => {
    if (!activeTabId) return

    if (formatOnSave) {
      await formatDocumentRef.current?.()
    }

    await saveTab(activeTabId)
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveAllTabs().catch((error) => {
          console.error('Failed to save all tabs:', error)
        })
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (activeTabId) {
          void saveActiveTab().catch((error) => {
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
        if (tabs.length <= 1 || !activeTabId) return
        const index = tabs.findIndex((t) => t.id === activeTabId)
        if (index < 0) return
        const nextIndex = event.shiftKey
          ? (index - 1 + tabs.length) % tabs.length
          : (index + 1) % tabs.length
        setActiveTab(tabs[nextIndex].id)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTabId, closeTab, setActiveTab, tabs, saveActiveTab, saveAllTabs])

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

  useEffect(() => {
    if (autoSaveMode !== 'afterDelay') return
    if (!activeTab || !activeTab.isDirty) return

    const timer = setTimeout(() => {
      void saveActiveTab().catch((error) => {
        console.error('Failed to auto-save active tab:', error)
      })
    }, autoSaveDelay)

    return () => {
      clearTimeout(timer)
    }
  }, [autoSaveMode, autoSaveDelay, activeTab, saveActiveTab])

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
              void saveActiveTab().catch((error) => {
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
                void saveActiveTab().catch((error) => {
                  console.error('Failed to auto-save on focus change:', error)
                })
              }
            }}
            onCursorChange={(position) => {
              setCursorPosition(position)
            }}
            onProblemsChange={(problems) => {
              setProblems(problems)
            }}
            onFormatDocumentReady={(formatDocument) => {
              formatDocumentRef.current = formatDocument
            }}
          />
        )}
      </div>
    </div>
  )
}
