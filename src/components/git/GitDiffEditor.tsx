import { useEffect, useState } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { getLanguageFromFileName } from '@/lib/utils'

interface GitDiffEditorProps {
  repoPath: string
  filePath?: string | null
}

function joinPath(base: string, relative: string): string {
  const sep = base.includes('\\') ? '\\' : '/'
  return `${base.replace(/[\\/]+$/, '')}${sep}${relative.replace(/^[\\/]+/, '')}`
}

function toDiffModelPath(scope: string, filePath: string): string {
  const encodedPath = Array.from(new TextEncoder().encode(`${scope}:${filePath}`))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return `git-diff://agent-ide/${encodedPath}`
}

export default function GitDiffEditor({ repoPath, filePath }: GitDiffEditorProps) {
  const [original, setOriginal] = useState('')
  const [modified, setModified] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!filePath) {
        setOriginal('')
        setModified('')
        return
      }

      setLoading(true)
      try {
        const currentFilePath = joinPath(repoPath, filePath)
        const [head, current] = await Promise.all([
          window.api.gitFileAtHead(repoPath, filePath).catch(() => ''),
          window.api.readFile(currentFilePath).catch(() => ''),
        ])
        if (!cancelled) {
          setOriginal(head)
          setModified(current)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [repoPath, filePath])

  if (!filePath) {
    return (
      <div className="px-3 py-4 text-xs text-[var(--text-muted)] text-center">
        Select a file to compare
      </div>
    )
  }

  if (loading) {
    return (
      <div className="px-3 py-4 text-xs text-[var(--text-muted)] text-center">
        Loading diff...
      </div>
    )
  }

  return (
    <div className="h-[420px] border border-[var(--border)] rounded-md overflow-hidden">
      <DiffEditor
        original={original}
        modified={modified}
        language={getLanguageFromFileName(filePath.split(/[/\\]/).pop() || filePath)}
        originalModelPath={toDiffModelPath('head', filePath)}
        modifiedModelPath={toDiffModelPath('worktree', filePath)}
        keepCurrentOriginalModel
        keepCurrentModifiedModel
        theme="vs-dark"
        options={{
          readOnly: true,
          renderSideBySide: true,
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  )
}
