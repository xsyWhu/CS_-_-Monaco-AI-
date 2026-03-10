import { create } from 'zustand'
import type { ProviderSettings } from '@/types/agent.types'

export type SidebarPanel = 'files' | 'search' | 'git'

interface SettingsState {
  provider: ProviderSettings | null
  workspacePath: string
  sidebarVisible: boolean
  chatVisible: boolean
  terminalVisible: boolean
  activeSidebarPanel: SidebarPanel
  loadSettings: () => Promise<void>
  updateProvider: (provider: ProviderSettings) => Promise<void>
  setWorkspacePath: (path: string) => void
  toggleSidebar: () => void
  toggleChatPanel: () => void
  toggleTerminal: () => void
  setActiveSidebarPanel: (panel: SidebarPanel) => void
  setSidebarPanel: (panel: SidebarPanel) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  provider: null,
  workspacePath: '',
  sidebarVisible: true,
  chatVisible: true,
  terminalVisible: false,
  activeSidebarPanel: 'files',

  loadSettings: async () => {
    try {
      const settings = await window.api.getSettings()
      set({
        provider: settings.provider ?? null,
        workspacePath: settings.workspacePath ?? '',
      })
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  },

  updateProvider: async (provider: ProviderSettings) => {
    try {
      await window.api.updateSettings({ provider })
      set({ provider })
    } catch (error) {
      console.error('Failed to update provider:', error)
    }
  },

  setWorkspacePath: (path: string) => {
    set({ workspacePath: path })
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarVisible: !state.sidebarVisible }))
  },

  toggleChatPanel: () => {
    set((state) => ({ chatVisible: !state.chatVisible }))
  },

  toggleTerminal: () => {
    set((state) => ({ terminalVisible: !state.terminalVisible }))
  },

  setActiveSidebarPanel: (panel: SidebarPanel) => {
    set({ activeSidebarPanel: panel })
  },

  setSidebarPanel: (panel: SidebarPanel) => {
    set({ activeSidebarPanel: panel })
  },
}))
