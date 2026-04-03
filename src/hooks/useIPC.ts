import { useEffect } from 'react'

type IPCChannel =
  | 'onFileChanged'
  | 'onTerminalData'
  | 'onAgentStream'
  | 'onAgentToolCall'
  | 'onAgentComplete'
  | 'onAgentError'

export function useIPCEvent(channel: IPCChannel, callback: (...args: any[]) => void): void {
  useEffect(() => {
    const unsubscribe = window.api[channel](callback as any)
    return () => {
      unsubscribe()
    }
  }, [channel])
}
