import type * as Monaco from 'monaco-editor'
import type { EditorProblem } from '@/types/editor.types'

class DocumentModelManager {
  private monacoInstance: typeof Monaco | null = null
  private uriToFilePath = new Map<string, string>()

  private normalizeFilePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\/+/, '')
  }

  attach(monaco: typeof Monaco): void {
    this.monacoInstance = monaco
  }

  getModelUri(filePath: string): string {
    const normalizedPath = this.normalizeFilePath(filePath)
    return `file-model:///model/${encodeURIComponent(normalizedPath)}`
  }

  register(filePath: string): string {
    const uri = this.getModelUri(filePath)
    this.uriToFilePath.set(uri, filePath)
    return uri
  }

  unregister(filePath: string): void {
    if (!this.monacoInstance) return
    const uri = this.getModelUri(filePath)
    this.uriToFilePath.delete(uri)
    const model = this.monacoInstance.editor.getModel(this.monacoInstance.Uri.parse(uri))
    if (model) {
      model.dispose()
    }
  }

  setModelLanguage(filePath: string, language: string): void {
    if (!this.monacoInstance) return
    const uri = this.getModelUri(filePath)
    const model = this.monacoInstance.editor.getModel(this.monacoInstance.Uri.parse(uri))
    if (model) {
      this.monacoInstance.editor.setModelLanguage(model, language)
    }
  }

  collectProblems(): EditorProblem[] {
    if (!this.monacoInstance) return []

    const problems: EditorProblem[] = []
    for (const model of this.monacoInstance.editor.getModels()) {
      const filePath = this.uriToFilePath.get(model.uri.toString())
      if (!filePath) continue

      const markers = this.monacoInstance.editor.getModelMarkers({ resource: model.uri })
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
}

export const documentModelManager = new DocumentModelManager()
