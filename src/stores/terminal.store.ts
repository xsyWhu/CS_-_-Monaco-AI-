import { create } from 'zustand'
import { useFileTreeStore } from './file-tree.store'

interface TerminalInfo {
  id: string
  title: string
}

interface TerminalState {
  terminals: TerminalInfo[]
  activeTerminalId: string | null

  createTerminal: () => Promise<void>
  closeTerminal: (id: string) => Promise<void>
  setActiveTerminal: (id: string) => void
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: [],
  activeTerminalId: null,

  createTerminal: async () => {
    const cwd = useFileTreeStore.getState().rootPath ?? undefined
    const result = await window.api.createTerminal({ cwd })
    const { terminals } = get()
    const terminal: TerminalInfo = {
      id: result.id,
      title: `Terminal ${terminals.length + 1}`,
    }
    set({ terminals: [...terminals, terminal], activeTerminalId: result.id })
  },

  closeTerminal: async (id) => {
    await window.api.closeTerminal(id)
    const { terminals, activeTerminalId } = get()
    const filtered = terminals.filter((t) => t.id !== id)
    let newActiveId = activeTerminalId
    if (activeTerminalId === id) {
      newActiveId = filtered.length > 0 ? filtered[filtered.length - 1].id : null
    }
    set({ terminals: filtered, activeTerminalId: newActiveId })
  },

  setActiveTerminal: (id) => set({ activeTerminalId: id }),
}))
