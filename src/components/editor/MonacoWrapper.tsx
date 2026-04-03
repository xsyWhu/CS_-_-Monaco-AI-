import Editor, { type OnMount } from '@monaco-editor/react'
import { useEffect, useRef } from 'react'
import type * as Monaco from 'monaco-editor'

interface MonacoWrapperProps {
  filePath: string
  content: string
  language: string
  revealPosition?: {
    line: number
    column: number
  } | null
  onRevealHandled?: () => void
  onChange: (value: string | undefined) => void
}

export default function MonacoWrapper({
  filePath,
  content,
  language,
  revealPosition,
  onRevealHandled,
  onChange,
}: MonacoWrapperProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)

  const revealPositionInEditor = () => {
    if (!editorRef.current || !revealPosition) return

    const line = Math.max(1, revealPosition.line)
    const column = Math.max(1, revealPosition.column)

    editorRef.current.focus()
    editorRef.current.setPosition({ lineNumber: line, column })
    editorRef.current.revealPositionInCenter({ lineNumber: line, column })
    editorRef.current.setSelection({
      startLineNumber: line,
      startColumn: column,
      endLineNumber: line,
      endColumn: column,
    })
    onRevealHandled?.()
  }

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor
    revealPositionInEditor()
  }

  useEffect(() => {
    revealPositionInEditor()
  }, [revealPosition])

  return (
    <Editor
      key={filePath}
      theme="vs-dark"
      language={language}
      value={content}
      onMount={handleMount}
      onChange={onChange}
      options={{
        minimap: { enabled: window.innerWidth > 1024 },
        fontSize: 14,
        lineNumbers: 'on',
        wordWrap: 'on',
        automaticLayout: true,
        tabSize: 2,
        scrollBeyondLastLine: false,
        padding: { top: 8 },
        smoothScrolling: true,
        cursorSmoothCaretAnimation: 'on',
        renderLineHighlight: 'gutter',
      }}
    />
  )
}
