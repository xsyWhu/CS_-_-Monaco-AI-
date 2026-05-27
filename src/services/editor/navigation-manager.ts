import type { FileTab, OutlineItem } from '@/types/editor.types'

export interface QuickOpenEntry {
  filePath: string
  fileName: string
  source: 'recent' | 'open' | 'search'
}

export function parseGoToLineInput(input: string): { line: number; column: number } | null {
  const normalized = input.trim()
  if (!normalized) return null

  const [lineText, columnText] = normalized.split(':')
  const line = Number(lineText)
  if (!Number.isFinite(line) || line < 1) return null

  const column = columnText ? Number(columnText) : 1
  if (!Number.isFinite(column) || column < 1) return null

  return {
    line: Math.floor(line),
    column: Math.floor(column),
  }
}

export function dedupeQuickOpenEntries(entries: QuickOpenEntry[]): QuickOpenEntry[] {
  const seen = new Set<string>()
  return entries.filter((entry) => {
    const key = entry.filePath.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function buildQuickOpenEntries(params: {
  query: string
  tabs: FileTab[]
  recentFiles: string[]
  searchResults: Array<{ filePath: string; fileName: string }>
}): QuickOpenEntry[] {
  const trimmed = params.query.trim()
  const filterByQuery = (name: string): boolean =>
    trimmed ? name.toLowerCase().includes(trimmed.toLowerCase()) : true

  const tabEntries = params.tabs
    .map((tab) => ({
      filePath: tab.filePath,
      fileName: tab.fileName,
      source: 'open' as const,
    }))
    .filter((item) => filterByQuery(item.fileName))

  const recentEntries = params.recentFiles
    .map((filePath) => ({
      filePath,
      fileName: filePath.split(/[/\\]/).pop() || filePath,
      source: 'recent' as const,
    }))
    .filter((item) => filterByQuery(item.fileName))

  const apiEntries = params.searchResults.map((item) => ({
    filePath: item.filePath,
    fileName: item.fileName,
    source: 'search' as const,
  }))

  return dedupeQuickOpenEntries([...tabEntries, ...recentEntries, ...apiEntries]).slice(0, 50)
}

function createOutlineItem(
  name: string,
  kind: string,
  line: number,
  column: number,
  depth: number,
): OutlineItem {
  return {
    id: `${kind}:${name}:${line}:${column}:${depth}`,
    name,
    kind,
    line,
    column,
    depth,
    children: [],
  }
}

export function buildMarkdownOutline(content: string): OutlineItem[] {
  const lines = content.split(/\r?\n/)
  const root: OutlineItem[] = []
  const stack: Array<{ level: number; children: OutlineItem[] }> = [{ level: 0, children: root }]

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.*)$/)
    if (!match) return

    const level = match[1].length
    const title = match[2].trim()
    const item = createOutlineItem(title, 'heading', index + 1, 1, level - 1)

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }

    const parent = stack[stack.length - 1]
    parent.children.push(item)
    stack.push({ level, children: item.children ?? [] })
  })

  return root
}
