import Editor, { type OnMount } from '@monaco-editor/react'
import { useEffect, useMemo, useRef } from 'react'
import type * as Monaco from 'monaco-editor'
import type { CursorPosition, EditorProblem } from '@/types/editor.types'
import { documentModelManager } from '@/services/editor/document-model-manager'
import { collectDiagnostics, subscribeToDiagnosticsChange } from '@/services/editor/diagnostics-manager'
import { languageFeatureManager, type LanguageFeatureActions } from '@/services/editor/language-feature-manager'
import { useSettingsStore } from '@/stores/settings.store'
import { getDebugBreakpointsForFile, useDebugStore } from '@/stores/debug.store'

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
  const monacoRef = useRef<typeof Monaco | null>(null)
  const markerListenerRef = useRef<Monaco.IDisposable | null>(null)
  const featureDisposablesRef = useRef<Monaco.IDisposable[]>([])
  const breakpointDecorationsRef = useRef<string[]>([])
  const executionDecorationsRef = useRef<string[]>([])
  const themeMode = useSettingsStore((s) => s.themeMode)
  const uiFontSize = useSettingsStore((s) => s.uiFontSize)
  const debugSession = useDebugStore((s) => s.session)
  const toggleBreakpoint = useDebugStore((s) => s.toggleBreakpoint)
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
    monacoRef.current = monaco
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

    const breakpointDisposable = editor.onMouseDown((event) => {
      const targetType = event.target.type
      const mouseTargetTypes = monaco.editor.MouseTargetType
      const isGutterClick =
        targetType === mouseTargetTypes.GUTTER_GLYPH_MARGIN ||
        targetType === mouseTargetTypes.GUTTER_LINE_NUMBERS
      if (!isGutterClick) return
      const lineNumber = event.target.position?.lineNumber
      if (!lineNumber) return
      void toggleBreakpoint(filePath, lineNumber).catch((error) => {
        console.error('Failed to toggle breakpoint:', error)
      })
    })
    featureDisposablesRef.current.push(breakpointDisposable)

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
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor) return
    if (!monaco) return

    const breakpoints = getDebugBreakpointsForFile(filePath)
    const breakpointDecorations = breakpoints
      .map((line) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: 'debug-breakpoint-glyph',
          overviewRuler: { color: '#ef4444', position: monaco.editor.OverviewRulerLane.Left },
        },
      }))

    breakpointDecorationsRef.current = editor.deltaDecorations(
      breakpointDecorationsRef.current,
      breakpointDecorations,
    )

    const stopped = debugSession.currentLocation
    const isStoppedHere =
      stopped &&
      stopped.filePath.replace(/\\/g, '/').toLowerCase() === filePath.replace(/\\/g, '/').toLowerCase()

    executionDecorationsRef.current = editor.deltaDecorations(
      executionDecorationsRef.current,
        isStoppedHere
        ? [
            {
              range: new monaco.Range(stopped.line, 1, stopped.line, 1),
              options: {
                isWholeLine: true,
                className: 'debug-current-line',
                linesDecorationsClassName: 'debug-current-line-decoration',
              },
            },
          ]
        : [],
    )
  }, [debugSession.currentLocation, debugSession.breakpoints, filePath, language])

  useEffect(() => {
    return () => {
      markerListenerRef.current?.dispose()
      markerListenerRef.current = null
      featureDisposablesRef.current.forEach((disposable) => disposable.dispose())
      featureDisposablesRef.current = []
      breakpointDecorationsRef.current = []
      executionDecorationsRef.current = []
    }
  }, [])

  return (
    <Editor
      path={modelUri}
      theme={themeMode === 'light' ? 'vs-light' : 'vs-dark'}
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
        fontSize: uiFontSize,
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
