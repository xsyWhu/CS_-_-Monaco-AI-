import { useMemo } from 'react'
import Editor from '@monaco-editor/react'
import { useEditorStore } from '../../stores/editor.store'
import InlineDiffView from './InlineDiffView'

const EMPTY_EDITOR_TEXT = `// Day 8 — Polished Agent IDE
// 请从左侧文件树点击一个文件，内容会显示在这里。
`

function getLanguageByFilePath(filePath: string | null): string {
  if (!filePath) return 'typescript'
  const ext = filePath.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts': case 'tsx': return 'typescript'
    case 'js': case 'jsx': return 'javascript'
    case 'json': return 'json'
    case 'css': return 'css'
    case 'html': return 'html'
    case 'md': return 'markdown'
    case 'yml': case 'yaml': return 'yaml'
    case 'py': return 'python'
    case 'sh': return 'shell'
    default: return 'plaintext'
  }
}

export default function MonacoWrapper() {
  const { openFilePath, openFileContent, setOpenFileContent, activeDiff } = useEditorStore()

  const editorLanguage = useMemo(() => getLanguageByFilePath(openFilePath), [openFilePath])
  const displayValue = openFilePath ? openFileContent : EMPTY_EDITOR_TEXT

  // Day 8: 当有激活的 Inline Diff 时，优先显示 Diff 审核视图。
  if (activeDiff) {
    return <InlineDiffView />
  }

  return (
    <Editor
      height="100%"
      path={openFilePath ?? 'welcome.ts'}
      language={editorLanguage}
      value={displayValue}
      onChange={(value) => {
        if (openFilePath) setOpenFileContent(value ?? '')
      }}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        automaticLayout: true,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        padding: { top: 12 },
        cursorBlinking: 'smooth',
        smoothScrolling: true,
      }}
    />
  )
}
