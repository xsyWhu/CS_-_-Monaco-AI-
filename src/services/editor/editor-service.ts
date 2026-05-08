import { useEditorStore } from '@/stores/editor.store'

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
