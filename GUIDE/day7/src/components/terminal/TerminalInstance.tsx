import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const PROMPT = 'PS > '

export default function TerminalInstance() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const commandBufferRef = useRef('')

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      convertEol: true,
      theme: {
        background: '#252526',
        foreground: '#cccccc'
      }
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminal.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    terminal.writeln('Day 6 Terminal Ready')
    terminal.write(PROMPT)

    const runCommand = async (command: string) => {
      const result = await window.api.runCommand(command)

      if (result.stdout) {
        terminal.writeln(result.stdout.replace(/\r?\n/g, '\r\n'))
      }

      if (result.stderr) {
        terminal.writeln(result.stderr.replace(/\r?\n/g, '\r\n'))
      }

      terminal.write(PROMPT)
    }

    const onDataDisposable = terminal.onData(async (data) => {
      if (data === '\r') {
        const command = commandBufferRef.current.trim()
        terminal.write('\r\n')

        if (command.length > 0) {
          await runCommand(command)
        } else {
          terminal.write(PROMPT)
        }

        commandBufferRef.current = ''
        return
      }

      if (data === '\u0003') {
        commandBufferRef.current = ''
        terminal.write('^C\r\n')
        terminal.write(PROMPT)
        return
      }

      if (data === '\u007f') {
        if (commandBufferRef.current.length > 0) {
          commandBufferRef.current = commandBufferRef.current.slice(0, -1)
          terminal.write('\b \b')
        }
        return
      }

      if (data >= ' ') {
        commandBufferRef.current += data
        terminal.write(data)
      }
    })

    const onResize = () => {
      fitAddon.fit()
    }

    window.addEventListener('resize', onResize)

    return () => {
      onDataDisposable.dispose()
      window.removeEventListener('resize', onResize)
      terminal.dispose()
    }
  }, [])

  return <div ref={containerRef} className="h-full w-full" />
}
