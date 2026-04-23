import Editor, { type OnMount } from '@monaco-editor/react'
import { useEffect, useMemo, useRef } from 'react'
import type * as Monaco from 'monaco-editor'
import type { CursorPosition, EditorProblem } from '@/types/editor.types'

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
  onBlur?: () => void
  onCursorChange?: (position: CursorPosition) => void
  onProblemsChange?: (problems: EditorProblem[]) => void
}

let monacoInstance: typeof Monaco | null = null
let monacoConfigured = false
const uriToFilePath = new Map<string, string>()

function toModelUri(filePath: string): string {
  return `file-model:///${encodeURIComponent(filePath)}`
}

function collectProblems(monaco: typeof Monaco): EditorProblem[] {
  const problems: EditorProblem[] = []

  for (const model of monaco.editor.getModels()) {
    const filePath = uriToFilePath.get(model.uri.toString())
    if (!filePath) continue

    const markers = monaco.editor.getModelMarkers({ resource: model.uri })
    for (const marker of markers) {
      problems.push({
        filePath,
        line: marker.startLineNumber,
        column: marker.startColumn,
        endLine: marker.endLineNumber,
        endColumn: marker.endColumn,
        message: marker.message,
        source: marker.source,
        code:
          typeof marker.code === 'string'
            ? marker.code
            : marker.code?.value
              ? String(marker.code.value)
              : undefined,
        severity: marker.severity,
      })
    }
  }

  return problems.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity - b.severity
    if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath)
    if (a.line !== b.line) return a.line - b.line
    return a.column - b.column
  })
}

export function disposeMonacoModel(filePath: string): void {
  if (!monacoInstance) return

  const uri = toModelUri(filePath)
  const model = monacoInstance.editor.getModel(monacoInstance.Uri.parse(uri))
  if (model) {
    model.dispose()
  }
  uriToFilePath.delete(uri)
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
  onBlur,
  onCursorChange,
  onProblemsChange,
}: MonacoWrapperProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const markerListenerRef = useRef<Monaco.IDisposable | null>(null)
  const modelUri = useMemo(() => toModelUri(filePath), [filePath])

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
    monacoInstance = monaco
    uriToFilePath.set(modelUri, filePath)

    if (onSave) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave()
      })
    }

    if (onSaveAll) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => {
        onSaveAll()
      })
    }

    const formatDocument = async (): Promise<void> => {
      const action = editor.getAction('editor.action.formatDocument')
      if (!action) return
      await action.run()
    }

    onFormatDocumentReady?.(formatDocument)
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      void formatDocument()
    })

    editor.onDidChangeCursorPosition((event) => {
      onCursorChange?.({
        line: event.position.lineNumber,
        column: event.position.column,
      })
    })

    editor.onDidBlurEditorText(() => {
      onBlur?.()
    })

    markerListenerRef.current?.dispose()
    markerListenerRef.current = monaco.editor.onDidChangeMarkers(() => {
      onProblemsChange?.(collectProblems(monaco))
    })

    onProblemsChange?.(collectProblems(monaco))
    revealPositionInEditor()
  }

  useEffect(() => {
    uriToFilePath.set(modelUri, filePath)
  }, [modelUri, filePath])

  useEffect(() => {
    revealPositionInEditor()
  }, [revealPosition?.requestId, filePath])

  useEffect(() => {
    if (!monacoInstance) return
    const model = monacoInstance.editor.getModel(monacoInstance.Uri.parse(modelUri))
    if (model) {
      monacoInstance.editor.setModelLanguage(model, language)
      onProblemsChange?.(collectProblems(monacoInstance))
    }
  }, [modelUri, language, onProblemsChange])

  useEffect(() => {
    return () => {
      markerListenerRef.current?.dispose()
      markerListenerRef.current = null
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

        const tsDefaults = monaco.languages.typescript.typescriptDefaults
        const jsDefaults = monaco.languages.typescript.javascriptDefaults

        tsDefaults.setEagerModelSync(true)
        jsDefaults.setEagerModelSync(true)

        const compilerOptions: Monaco.languages.typescript.CompilerOptions = {
          target: monaco.languages.typescript.ScriptTarget.ES2022,
          module: monaco.languages.typescript.ModuleKind.ESNext,
          moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          allowJs: true,
          allowNonTsExtensions: true,
          jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
          strict: true,
          noEmit: true,
          resolveJsonModule: true,
          esModuleInterop: true,
          forceConsistentCasingInFileNames: true,
          skipLibCheck: true,
        }

        tsDefaults.setCompilerOptions(compilerOptions)
        jsDefaults.setCompilerOptions({
          ...compilerOptions,
          checkJs: true,
        })

        tsDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          noSuggestionDiagnostics: false,
        })
        jsDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          noSuggestionDiagnostics: false,
        })
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
        linkedEditing: true,
      }}
    />
  )
}
