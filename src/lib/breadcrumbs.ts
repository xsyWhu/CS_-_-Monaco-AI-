import type { CursorPosition, OutlineItem } from '@/types/editor.types'

export interface BreadcrumbSegment {
  id: string
  label: string
  line?: number
  column?: number
  kind?: string
  path?: string
}

function isBeforeOrEqual(candidate: OutlineItem, cursor: CursorPosition): boolean {
  return candidate.line < cursor.line || (candidate.line === cursor.line && candidate.column <= cursor.column)
}

function findOutlineTrail(items: OutlineItem[], cursor: CursorPosition): OutlineItem[] {
  let best: OutlineItem | null = null

  for (const item of items) {
    if (!isBeforeOrEqual(item, cursor)) continue
    if (!best || item.line > best.line || (item.line === best.line && item.column > best.column)) {
      best = item
    }
  }

  if (!best) return []

  const childTrail = best.children?.length ? findOutlineTrail(best.children, cursor) : []
  return [best, ...childTrail]
}

export function buildFileBreadcrumbs(filePath: string): BreadcrumbSegment[] {
  const separator = filePath.includes('\\') ? '\\' : '/'
  const normalized = filePath.replace(/[\\/]+/g, separator)
  const segments = normalized.split(separator).filter(Boolean)

  return segments.map((segment, index) => ({
    id: `${filePath}:${index}:${segment}`,
    label: segment,
    path: segments.slice(0, index + 1).join(separator),
  }))
}

export function buildSymbolBreadcrumbs(
  outlineItems: OutlineItem[],
  cursor: CursorPosition,
): BreadcrumbSegment[] {
  return findOutlineTrail(outlineItems, cursor).map((item, index) => ({
    id: `${item.id}:${index}`,
    label: item.name,
    line: item.line,
    column: item.column,
    kind: item.kind,
  }))
}
