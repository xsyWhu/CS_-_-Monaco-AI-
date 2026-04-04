import { useRef, useEffect } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalInstanceProps {
  terminalId: string
}

export default function TerminalInstance({ terminalId }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

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
      theme: {
        background: '#181825',
        foreground: '#cdd6f4',
        cursor: '#89b4fa',
      },
      fontFamily: 'Consolas, Monaco, monospace',
      fontSize: 13,
      cursorBlink: true,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)

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

  return <div ref={containerRef} className="h-full w-full" />
}
