import type * as Monaco from 'monaco-editor'
import type { CursorPosition } from '@/types/editor.types'

export interface LanguageFeatureCallbacks {
  onSave?: () => void
  onSaveAll?: () => void
  onFormatDocumentReady?: (formatDocument: () => Promise<void>) => void
  onActionsReady?: (actions: LanguageFeatureActions) => void
  onCursorChange?: (position: CursorPosition) => void
  onBlur?: () => void
}

export interface LanguageFeatureActions {
  formatDocument: () => Promise<void>
  formatSelection: () => Promise<void>
  goToDefinition: () => Promise<void>
  peekDefinition: () => Promise<void>
  findReferences: () => Promise<void>
  peekReferences: () => Promise<void>
  renameSymbol: () => Promise<void>
  quickFix: () => Promise<void>
}

const sharedModeConfiguration = {
  documentFormattingEdits: true,
  documentRangeFormattingEdits: true,
  completionItems: true,
  hovers: true,
  documentSymbols: true,
  definitions: true,
  references: true,
  rename: true,
  colors: true,
  foldingRanges: true,
  diagnostics: true,
  selectionRanges: true,
}

class LanguageFeatureManager {
  private configured = false

  configureMonaco(monaco: typeof Monaco): void {
    if (this.configured) return
    this.configured = true

    this.configureTypeScriptJavaScript(monaco)
    this.configureJson(monaco)
    this.configureMarkupLanguages(monaco)
  }

  registerEditorFeatures(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
    callbacks: LanguageFeatureCallbacks = {},
  ): Monaco.IDisposable[] {
    const disposables: Monaco.IDisposable[] = []

    if (callbacks.onSave) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        callbacks.onSave?.()
      })
    }

    if (callbacks.onSaveAll) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => {
        callbacks.onSaveAll?.()
      })
    }

    const runAction = async (actionId: string): Promise<void> => {
      const action = editor.getAction(actionId)
      if (!action) return
      await action.run()
    }

    const formatDocument = async (): Promise<void> => {
      await runAction('editor.action.formatDocument')
    }

    const formatSelection = async (): Promise<void> => {
      await runAction('editor.action.formatSelection')
    }
    const goToDefinition = async (): Promise<void> => {
      await runAction('editor.action.revealDefinition')
    }
    const peekDefinition = async (): Promise<void> => {
      await runAction('editor.action.peekDefinition')
    }
    const findReferences = async (): Promise<void> => {
      await runAction('editor.action.referenceSearch.trigger')
    }
    const peekReferences = async (): Promise<void> => {
      await runAction('editor.action.referenceSearch.trigger')
    }
    const renameSymbol = async (): Promise<void> => {
      await runAction('editor.action.rename')
    }
    const quickFix = async (): Promise<void> => {
      await runAction('editor.action.quickFix')
    }

    callbacks.onFormatDocumentReady?.(formatDocument)
    callbacks.onActionsReady?.({
      formatDocument,
      formatSelection,
      goToDefinition,
      peekDefinition,
      findReferences,
      peekReferences,
      renameSymbol,
      quickFix,
    })

    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      void formatDocument()
    })

    disposables.push(
      editor.addAction({
        id: 'agentide.formatSelection',
        label: 'Format Selection',
        contextMenuGroupId: '1_modification',
        contextMenuOrder: 8,
        run: () => formatSelection(),
      }),
    )

    disposables.push(
      editor.addAction({
        id: 'agentide.goToDefinition',
        label: 'Go to Definition',
        keybindings: [monaco.KeyCode.F12],
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1,
        run: () => runAction('editor.action.revealDefinition'),
      }),
    )

    disposables.push(
      editor.addAction({
        id: 'agentide.peekDefinition',
        label: 'Peek Definition',
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.F12],
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 2,
        run: () => runAction('editor.action.peekDefinition'),
      }),
    )

    disposables.push(
      editor.addAction({
        id: 'agentide.findReferences',
        label: 'Find References',
        keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F12],
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 3,
        run: () => runAction('editor.action.referenceSearch.trigger'),
      }),
    )

    disposables.push(
      editor.addAction({
        id: 'agentide.peekReferences',
        label: 'Peek References',
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 4,
        run: () => runAction('editor.action.referenceSearch.trigger'),
      }),
    )

    disposables.push(
      editor.addAction({
        id: 'agentide.renameSymbol',
        label: 'Rename Symbol',
        keybindings: [monaco.KeyCode.F2],
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 5,
        run: () => runAction('editor.action.rename'),
      }),
    )

    disposables.push(
      editor.addAction({
        id: 'agentide.quickFix',
        label: 'Quick Fix',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Period],
        contextMenuGroupId: '1_modification',
        contextMenuOrder: 1,
        run: () => runAction('editor.action.quickFix'),
      }),
    )

    disposables.push(
      editor.onDidChangeCursorPosition((event) => {
        callbacks.onCursorChange?.({
          line: event.position.lineNumber,
          column: event.position.column,
        })
      }),
    )

    disposables.push(
      editor.onDidBlurEditorText(() => {
        callbacks.onBlur?.()
      }),
    )

    return disposables
  }

  private configureTypeScriptJavaScript(monaco: typeof Monaco): void {
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
  }

  private configureJson(monaco: typeof Monaco): void {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: true,
      comments: 'warning',
      trailingCommas: 'warning',
      schemaValidation: 'warning',
      schemaRequest: 'warning',
    })
    monaco.languages.json.jsonDefaults.setModeConfiguration(sharedModeConfiguration)
  }

  private configureMarkupLanguages(monaco: typeof Monaco): void {
    const languages = monaco.languages as typeof monaco.languages & Record<string, unknown>
    const configs = [
      (languages as { htmlDefaults?: Monaco.languages.LanguageServiceDefaults }).htmlDefaults ??
        (languages as { html?: { htmlDefaults?: Monaco.languages.LanguageServiceDefaults } }).html
          ?.htmlDefaults,
      (languages as { cssDefaults?: Monaco.languages.LanguageServiceDefaults }).cssDefaults,
      (languages as { scssDefaults?: Monaco.languages.LanguageServiceDefaults }).scssDefaults,
      (languages as { lessDefaults?: Monaco.languages.LanguageServiceDefaults }).lessDefaults,
    ]

    for (const defaults of configs) {
      if (defaults?.setModeConfiguration) {
        defaults.setModeConfiguration(sharedModeConfiguration)
      }
    }
  }
}

export const languageFeatureManager = new LanguageFeatureManager()
