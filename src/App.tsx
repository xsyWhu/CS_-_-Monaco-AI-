import { Component, type ErrorInfo, type ReactNode, useEffect } from 'react'
import AppLayout from './components/layout/AppLayout'
import { useSettingsStore } from '@/stores/settings.store'
import { useFileTreeStore } from '@/stores/file-tree.store'
import { useEditorStore } from '@/stores/editor.store'

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message + '\n' + error.stack }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App crash:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: '#f38ba8', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <h2>Application Error</h2>
          <pre>{this.state.error}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const rootPath = useFileTreeStore((s) => s.rootPath)

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (!rootPath) return

    void window.api.watchDirectory(rootPath)
    return () => {
      void window.api.unwatchDirectory(rootPath)
    }
  }, [rootPath])

  useEffect(() => {
    const normalizePath = (input: string) => input.replace(/\\/g, '/').toLowerCase()

    return window.api.onFileChanged((eventType, filePath) => {
      const currentRoot = useFileTreeStore.getState().rootPath
      if (!currentRoot) return

      const root = normalizePath(currentRoot).replace(/\/+$/, '')
      const target = normalizePath(filePath)
      if (!(target === root || target.startsWith(`${root}/`))) return

      void useFileTreeStore.getState().refreshTree()

      if (eventType === 'change' || eventType === 'unlink') {
        void useEditorStore.getState().reloadFileFromDisk(filePath)
      }
    })
  }, [])

  useEffect(() => {
    let closing = false

    return window.api.onAppRequestClose(() => {
      if (closing) return
      closing = true

      void useEditorStore
        .getState()
        .saveAllTabs()
        .catch((error) => {
          console.error('Failed to auto-save files before close:', error)
        })
        .finally(() => {
          void window.api.confirmClose()
        })
    })
  }, [])

  return (
    <ErrorBoundary>
      <div className="h-full flex flex-col">
        <AppLayout />
      </div>
    </ErrorBoundary>
  )
}
