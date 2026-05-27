import { create } from 'zustand'
import type { ProviderSettings } from '@/types/agent.types'

export type SidebarPanel = 'files' | 'outline' | 'search' | 'problems' | 'git'
export type AutoSaveMode = 'off' | 'afterDelay' | 'onFocusChange'
export type ThemeMode = 'dark' | 'light'

interface EditorPreferences {
  autoSaveMode: AutoSaveMode
  autoSaveDelay: number
  formatOnSave: boolean
}

interface AppearancePreferences {
  themeMode: ThemeMode
  uiFontSize: number
}

interface SettingsState {
  provider: ProviderSettings | null
  workspacePath: string
  autoSaveMode: AutoSaveMode
  autoSaveDelay: number
  formatOnSave: boolean
  themeMode: ThemeMode
  uiFontSize: number
  sidebarVisible: boolean
  chatVisible: boolean
  terminalVisible: boolean
  activeSidebarPanel: SidebarPanel
  loadSettings: () => Promise<void>
  updateProvider: (provider: ProviderSettings) => Promise<void>
  setAutoSaveMode: (mode: AutoSaveMode) => void
  setAutoSaveDelay: (delay: number) => void
  setFormatOnSave: (enabled: boolean) => void
  setThemeMode: (mode: ThemeMode) => void
  toggleThemeMode: () => void
  setUIFontSize: (size: number) => void
  setWorkspacePath: (path: string) => void
  toggleSidebar: () => void
  toggleChatPanel: () => void
  toggleTerminal: () => void
  setActiveSidebarPanel: (panel: SidebarPanel) => void
  setSidebarPanel: (panel: SidebarPanel) => void
}

const EDITOR_PREFS_KEY = 'agent-ide.editor.preferences.v1'
const APPEARANCE_PREFS_KEY = 'agent-ide.appearance.v1'

function clampFontSize(size: number): number {
  return Math.max(13, Math.min(20, Math.floor(size)))
}

function loadEditorPreferences(): EditorPreferences {
  try {
    const raw = localStorage.getItem(EDITOR_PREFS_KEY)
    if (!raw) return { autoSaveMode: 'off', autoSaveDelay: 1000, formatOnSave: false }
    const parsed = JSON.parse(raw) as Partial<EditorPreferences>
    return {
      autoSaveMode: parsed.autoSaveMode ?? 'off',
      autoSaveDelay:
        typeof parsed.autoSaveDelay === 'number' && parsed.autoSaveDelay > 0
          ? parsed.autoSaveDelay
          : 1000,
      formatOnSave: parsed.formatOnSave ?? false,
    }
  } catch {
    return { autoSaveMode: 'off', autoSaveDelay: 1000, formatOnSave: false }
  }
}

function saveEditorPreferences(prefs: EditorPreferences): void {
  try {
    localStorage.setItem(EDITOR_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore localStorage errors
  }
}

function loadAppearancePreferences(): AppearancePreferences {
  try {
    const raw = localStorage.getItem(APPEARANCE_PREFS_KEY)
    if (!raw) return { themeMode: 'dark', uiFontSize: 15 }
    const parsed = JSON.parse(raw) as Partial<AppearancePreferences>
    return {
      themeMode: parsed.themeMode === 'light' ? 'light' : 'dark',
      uiFontSize: clampFontSize(typeof parsed.uiFontSize === 'number' ? parsed.uiFontSize : 15),
    }
  } catch {
    return { themeMode: 'dark', uiFontSize: 15 }
  }
}

function saveAppearancePreferences(prefs: AppearancePreferences): void {
  try {
    localStorage.setItem(APPEARANCE_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore localStorage errors
  }
}

function applyAppearance(themeMode: ThemeMode, uiFontSize: number): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.dataset.theme = themeMode
  root.style.setProperty('--app-font-size', `${uiFontSize}px`)
}

const initialAppearance = loadAppearancePreferences()
applyAppearance(initialAppearance.themeMode, initialAppearance.uiFontSize)

export const useSettingsStore = create<SettingsState>((set) => ({
  provider: null,
  workspacePath: '',
  ...loadEditorPreferences(),
  ...initialAppearance,
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

  setAutoSaveMode: (mode: AutoSaveMode) => {
    set((state) => {
      const next = { autoSaveMode: mode, autoSaveDelay: state.autoSaveDelay }
      saveEditorPreferences(next)
      return next
    })
  },

  setAutoSaveDelay: (delay: number) => {
    const normalized = Math.max(300, Math.min(10000, Math.floor(delay)))
    set((state) => {
      const next = {
        autoSaveMode: state.autoSaveMode,
        autoSaveDelay: normalized,
        formatOnSave: state.formatOnSave,
      }
      saveEditorPreferences(next)
      return { autoSaveDelay: normalized }
    })
  },

  setFormatOnSave: (enabled: boolean) => {
    set((state) => {
      const next = {
        autoSaveMode: state.autoSaveMode,
        autoSaveDelay: state.autoSaveDelay,
        formatOnSave: enabled,
      }
      saveEditorPreferences(next)
      return { formatOnSave: enabled }
    })
  },

  setThemeMode: (mode: ThemeMode) => {
    set((state) => {
      const next = { themeMode: mode, uiFontSize: state.uiFontSize }
      saveAppearancePreferences(next)
      applyAppearance(next.themeMode, next.uiFontSize)
      return { themeMode: mode }
    })
  },

  toggleThemeMode: () => {
    set((state) => {
      const mode = state.themeMode === 'dark' ? 'light' : 'dark'
      const next = { themeMode: mode, uiFontSize: state.uiFontSize }
      saveAppearancePreferences(next)
      applyAppearance(next.themeMode, next.uiFontSize)
      return { themeMode: mode }
    })
  },

  setUIFontSize: (size: number) => {
    const uiFontSize = clampFontSize(size)
    set((state) => {
      const next = { themeMode: state.themeMode, uiFontSize }
      saveAppearancePreferences(next)
      applyAppearance(next.themeMode, next.uiFontSize)
      return { uiFontSize }
    })
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
