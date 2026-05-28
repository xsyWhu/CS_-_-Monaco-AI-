import { useEditorStore } from '@/stores/editor.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useTerminalStore } from '@/stores/terminal.store'

export function isCppFilePath(filePath: string): boolean {
  return /\.(cpp|cc|cxx)$/i.test(filePath)
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''")
}

function getDirectory(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  if (index === -1) return '.'
  return filePath.slice(0, index)
}

function getBaseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  return index === -1 ? filePath : filePath.slice(index + 1)
}

function getBaseNameWithoutExtension(filePath: string): string {
  const baseName = getBaseName(filePath)
  const dotIndex = baseName.lastIndexOf('.')
  return dotIndex === -1 ? baseName : baseName.slice(0, dotIndex)
}

async function ensureTerminalForRun(cwd: string): Promise<string> {
  const terminalStore = useTerminalStore.getState()
  const activeTerminalId = terminalStore.activeTerminalId
  if (activeTerminalId) {
    return activeTerminalId
  }

  return await terminalStore.createTerminal({ cwd, shell: 'powershell.exe' })
}

export async function saveActiveTab(): Promise<void> {
  const store = useEditorStore.getState()
  if (!store.activeTabId) return
  await store.saveTab(store.activeTabId)
}

export async function saveAllTabs(): Promise<void> {
  await useEditorStore.getState().saveAllTabs()
}

export async function closeActiveTab(): Promise<void> {
  const store = useEditorStore.getState()
  if (!store.activeTabId) return
  await store.closeTab(store.activeTabId)
}

export async function reopenClosedTab(): Promise<void> {
  await useEditorStore.getState().reopenClosedTab()
}

export function toggleSplitView(): void {
  useEditorStore.getState().toggleSplitView()
}

export function setActiveTab(tabId: string): void {
  useEditorStore.getState().setActiveTab(tabId)
}

export async function runCurrentCppFile(): Promise<void> {
  const store = useEditorStore.getState()
  const activeTab = store.tabs.find((tab) => tab.id === store.activeTabId) ?? null
  if (!activeTab || !isCppFilePath(activeTab.filePath)) {
    return
  }

  await saveActiveTab()

  const terminalVisible = useSettingsStore.getState().terminalVisible
  if (!terminalVisible) {
    useSettingsStore.getState().toggleTerminal()
  }

  const cwd = getDirectory(activeTab.filePath)
  const terminalId = await ensureTerminalForRun(cwd)
  const inputFile = escapePowerShellSingleQuoted(activeTab.filePath)
  const outputFile = escapePowerShellSingleQuoted(
    `${getDirectory(activeTab.filePath)}\\${getBaseNameWithoutExtension(activeTab.filePath)}.exe`,
  )
  const command = [
    `Set-Location -LiteralPath '${escapePowerShellSingleQuoted(cwd)}'`,
    `g++ -std=c++17 -O2 -Wall -Wextra -o '${outputFile}' '${inputFile}'`,
    `if ($LASTEXITCODE -eq 0) { & '${outputFile}' }`,
  ].join('; ')

  await window.api.writeTerminal(terminalId, `${command}\r`)
}
