export interface ShortcutDefinition {
  key: string
  ctrlOrMeta?: boolean
  shift?: boolean
  alt?: boolean
}

export const EditorCommands = {
  quickOpen: 'editor.quickOpen',
  gotoLine: 'editor.gotoLine',
  save: 'editor.save',
  saveAll: 'editor.saveAll',
  closeTab: 'editor.closeTab',
  reopenClosedTab: 'editor.reopenClosedTab',
  toggleSplitView: 'editor.toggleSplitView',
  outline: 'editor.outline',
} as const

export const EditorShortcuts = {
  quickOpen: { key: 'p', ctrlOrMeta: true },
  gotoLine: { key: 'g', ctrlOrMeta: true },
  save: { key: 's', ctrlOrMeta: true },
  saveAll: { key: 's', ctrlOrMeta: true, shift: true },
  closeTab: { key: 'w', ctrlOrMeta: true },
  reopenClosedTab: { key: 't', ctrlOrMeta: true, shift: true },
  toggleSplitView: { key: '\\', ctrlOrMeta: true },
  outline: { key: 'o', ctrlOrMeta: true, shift: true },
} as const satisfies Record<string, ShortcutDefinition>

export function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    (!!shortcut.ctrlOrMeta === (event.ctrlKey || event.metaKey)) &&
    (!!shortcut.shift === event.shiftKey) &&
    (!!shortcut.alt === event.altKey)
  )
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  return !!element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable)
}
