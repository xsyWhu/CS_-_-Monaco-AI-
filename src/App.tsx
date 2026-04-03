import { Component, type ErrorInfo, type ReactNode, useEffect } from 'react'
import AppLayout from './components/layout/AppLayout'
import { useSettingsStore } from '@/stores/settings.store'

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

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return (
    <ErrorBoundary>
      <div className="h-full flex flex-col">
        <AppLayout />
      </div>
    </ErrorBoundary>
  )
}
