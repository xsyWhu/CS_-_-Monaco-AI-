import { useRef, useEffect } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useSettingsStore } from '@/stores/settings.store'

interface TerminalInstanceProps {
  terminalId: string
}

export default function TerminalInstance({ terminalId }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const themeMode = useSettingsStore((s) => s.themeMode)
  const uiFontSize = useSettingsStore((s) => s.uiFontSize)

  const applyTerminalAppearance = () => {
    const terminal = terminalRef.current
    if (!terminal) return

    const isLight = themeMode === 'light'
    terminal.options.fontSize = Math.max(uiFontSize - 1, 12)
    terminal.options.theme = {
      background: isLight ? '#f6f8fc' : '#181825',
      foreground: isLight ? '#1f2937' : '#cdd6f4',
      cursor: isLight ? '#2563eb' : '#89b4fa',
      selectionBackground: isLight ? '#bfdbfe' : '#45475a',
    }
  }

  const syncTerminalSize = () => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    if (!terminal || !fitAddon) return

    try {
      fitAddon.fit()
      window.api.resizeTerminal(terminalId, terminal.cols, terminal.rows)
    } catch {
      // Ignore transient resize failures during layout changes
    }
  }

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      fontFamily: 'Consolas, Monaco, monospace',
      cursorBlink: true,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    applyTerminalAppearance()

    requestAnimationFrame(() => {
      syncTerminalSize()
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const dataDisposable = terminal.onData((data) => {
      window.api.writeTerminal(terminalId, data)
    })

    const removeIpcListener = window.api.onTerminalData(({ id, data }) => {
      if (id === terminalId) {
        terminal.write(data)
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        syncTerminalSize()
      })
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      dataDisposable.dispose()
      removeIpcListener()
      resizeObserver.disconnect()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [terminalId])

  useEffect(() => {
    applyTerminalAppearance()
  }, [themeMode, uiFontSize])

  return <div ref={containerRef} className="h-full w-full" />
}
