export interface EditorTab {
  id: string
  filePath: string
  fileName: string
  language: string
  content: string
  isDirty: boolean
  isActive: boolean
  isPinned?: boolean
}

export type FileTab = EditorTab

export interface CursorPosition {
  line: number
  column: number
}

export interface EditorProblem {
  filePath: string
  line: number
  column: number
  endLine: number
  endColumn: number
  message: string
  source?: string
  code?: string
  severity: number
}

export interface OutlineItem {
  id: string
  name: string
  kind: string
  line: number
  column: number
  depth: number
  children?: OutlineItem[]
}

export interface FileTreeNode {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  size?: number
  modifiedTime?: number
  children?: FileTreeNode[]
  isLoading?: boolean
}

export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
    json: 'json', md: 'markdown', html: 'html', css: 'css', scss: 'scss', less: 'less',
    py: 'python', rs: 'rust', go: 'go', java: 'java', c: 'c', cpp: 'cpp', h: 'c',
    hpp: 'cpp', cs: 'csharp', rb: 'ruby', php: 'php', swift: 'swift', kt: 'kotlin',
    sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'powershell', yaml: 'yaml',
    yml: 'yaml', toml: 'toml', xml: 'xml', sql: 'sql', graphql: 'graphql',
    vue: 'vue', svelte: 'svelte', dockerfile: 'dockerfile',
  }
  return map[ext] || 'plaintext'
}
