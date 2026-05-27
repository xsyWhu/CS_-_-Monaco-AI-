import Editor, { type OnMount } from '@monaco-editor/react'
import { useEffect, useMemo, useRef } from 'react'
import type * as Monaco from 'monaco-editor'
import type { CursorPosition, EditorProblem } from '@/types/editor.types'
import { documentModelManager } from '@/services/editor/document-model-manager'
import { collectDiagnostics, subscribeToDiagnosticsChange } from '@/services/editor/diagnostics-manager'
import { languageFeatureManager, type LanguageFeatureActions } from '@/services/editor/language-feature-manager'

interface MonacoWrapperProps {
  filePath: string
  content: string
  language: string
  revealPosition?: {
    line: number
    column: number
    requestId: number
  } | null
  onRevealHandled?: () => void
  onChange: (value: string | undefined) => void
  onSave?: () => void
  onSaveAll?: () => void
  onFormatDocumentReady?: (formatDocument: () => Promise<void>) => void
  onActionsReady?: (actions: LanguageFeatureActions) => void
  onBlur?: () => void
  onCursorChange?: (position: CursorPosition) => void
  onProblemsChange?: (problems: EditorProblem[]) => void
}

let monacoConfigured = false

export function disposeMonacoModel(filePath: string): void {
  documentModelManager.unregister(filePath)
}

export default function MonacoWrapper({
  filePath,
  content,
  language,
  revealPosition,
  onRevealHandled,
  onChange,
  onSave,
  onSaveAll,
  onFormatDocumentReady,
  onActionsReady,
  onBlur,
  onCursorChange,
  onProblemsChange,
}: MonacoWrapperProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const markerListenerRef = useRef<Monaco.IDisposable | null>(null)
  const featureDisposablesRef = useRef<Monaco.IDisposable[]>([])
  const modelUri = useMemo(() => documentModelManager.getModelUri(filePath), [filePath])

  const revealPositionInEditor = () => {
    if (!editorRef.current || !revealPosition) return

    const line = Math.max(1, revealPosition.line)
    const column = Math.max(1, revealPosition.column)

    requestAnimationFrame(() => {
      if (!editorRef.current) return
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
    })
  }

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    documentModelManager.attach(monaco)
    documentModelManager.register(filePath)

    featureDisposablesRef.current.forEach((disposable) => disposable.dispose())
    featureDisposablesRef.current = languageFeatureManager.registerEditorFeatures(editor, monaco, {
      onSave,
      onSaveAll,
      onFormatDocumentReady,
      onActionsReady,
      onCursorChange,
      onBlur,
    })

    markerListenerRef.current?.dispose()
    markerListenerRef.current = subscribeToDiagnosticsChange(monaco, (problems) => {
      onProblemsChange?.(problems)
    })

    onProblemsChange?.(collectDiagnostics())
    revealPositionInEditor()
  }

  useEffect(() => {
    documentModelManager.register(filePath)
  }, [filePath, modelUri])

  useEffect(() => {
    revealPositionInEditor()
  }, [revealPosition?.requestId, filePath])

  useEffect(() => {
    documentModelManager.setModelLanguage(filePath, language)
    onProblemsChange?.(collectDiagnostics())
  }, [filePath, language, onProblemsChange])

  useEffect(() => {
    return () => {
      markerListenerRef.current?.dispose()
      markerListenerRef.current = null
      featureDisposablesRef.current.forEach((disposable) => disposable.dispose())
      featureDisposablesRef.current = []
    }
  }, [])

  return (
    <Editor
      path={modelUri}
      theme="vs-dark"
      language={language}
      value={content}
      beforeMount={(monaco) => {
        if (monacoConfigured) return
        monacoConfigured = true
        languageFeatureManager.configureMonaco(monaco)
      }}
      onMount={handleMount}
      onChange={onChange}
      saveViewState
      keepCurrentModel
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
        glyphMargin: true,
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        formatOnPaste: true,
        formatOnType: true,
        codeLens: true,
        folding: true,
        overviewRulerLanes: 2,
        linkedEditing: true,
      }}
    />
  )
}
