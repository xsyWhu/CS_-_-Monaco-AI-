import Editor from '@monaco-editor/react'

interface MonacoWrapperProps {
  filePath: string
  content: string
  language: string
  onChange: (value: string | undefined) => void
}

export default function MonacoWrapper({
  filePath,
  content,
  language,
  onChange,
}: MonacoWrapperProps) {
  return (
    <Editor
      key={filePath}
      theme="vs-dark"
      language={language}
      value={content}
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
