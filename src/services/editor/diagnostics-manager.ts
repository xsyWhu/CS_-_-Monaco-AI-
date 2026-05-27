import type * as Monaco from 'monaco-editor'
import type { EditorProblem } from '@/types/editor.types'
import { documentModelManager } from './document-model-manager'

export function collectDiagnostics(): EditorProblem[] {
  return documentModelManager.collectProblems()
}

export function subscribeToDiagnosticsChange(
  monaco: typeof Monaco,
  onChange: (problems: EditorProblem[]) => void,
): Monaco.IDisposable {
  return monaco.editor.onDidChangeMarkers(() => {
    onChange(collectDiagnostics())
  })
}
