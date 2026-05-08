import Editor, { type OnMount } from '@monaco-editor/react'
import { useEffect, useMemo, useRef } from 'react'
import type * as Monaco from 'monaco-editor'
import type { CursorPosition, EditorProblem } from '@/types/editor.types'
import { documentModelManager } from '@/services/editor/document-model-manager'
import { collectDiagnostics, subscribeToDiagnosticsChange } from '@/services/editor/diagnostics-manager'

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
  onBlur,
  onCursorChange,
  onProblemsChange,
}: MonacoWrapperProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const markerListenerRef = useRef<Monaco.IDisposable | null>(null)
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

    const runAction = async (actionId: string): Promise<void> => {
      const action = editor.getAction(actionId)
      if (!action) return
      await action.run()
    }

    editor.addAction({
      id: 'agentide.goToDefinition',
      label: 'Go to Definition',
      keybindings: [monaco.KeyCode.F12],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1,
      run: () => runAction('editor.action.revealDefinition'),
    })

    editor.addAction({
      id: 'agentide.findReferences',
      label: 'Find References',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F12],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 2,
      run: () => runAction('editor.action.referenceSearch.trigger'),
    })

    editor.addAction({
      id: 'agentide.renameSymbol',
      label: 'Rename Symbol',
      keybindings: [monaco.KeyCode.F2],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 3,
      run: () => runAction('editor.action.rename'),
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
        codeLens: true,
        folding: true,
        overviewRulerLanes: 2,
        linkedEditing: true,
      }}
    />
  )
}
