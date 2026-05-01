import { useEffect, useState } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { getLanguageFromFileName } from '@/lib/utils'

interface GitDiffEditorProps {
  repoPath: string
  filePath?: string | null
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
        const [head, current] = await Promise.all([
          window.api.gitFileAtHead(repoPath, filePath).catch(() => ''),
          window.api.readFile(filePath).catch(() => ''),
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
        originalModelPath={`git-head:///${encodeURIComponent(filePath)}`}
        modifiedModelPath={`file:///${encodeURIComponent(filePath)}`}
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
