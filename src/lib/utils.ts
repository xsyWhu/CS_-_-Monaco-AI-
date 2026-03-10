export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ')
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function getLanguageFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
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

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString()
}

export function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const iconMap: Record<string, string> = {
    ts: 'file-code-2', tsx: 'file-code-2', js: 'file-code-2', jsx: 'file-code-2',
    json: 'file-json', md: 'file-text', html: 'file-code', css: 'file-code',
    py: 'file-code-2', rs: 'file-code-2', go: 'file-code-2',
    png: 'image', jpg: 'image', gif: 'image', svg: 'image',
    pdf: 'file-text',
  }
  return iconMap[ext] || 'file'
}
