import { AlertCircle, AlertTriangle, Info, XCircle } from 'lucide-react'
import { useEditorStore } from '@/stores/editor.store'

function severityLabel(severity: number): string {
  if (severity <= 1) return 'Error'
  if (severity === 2) return 'Warning'
  if (severity === 4) return 'Hint'
  return 'Info'
}

function SeverityIcon({ severity }: { severity: number }) {
  if (severity <= 1) return <XCircle size={12} className="text-[var(--error)]" />
  if (severity === 2) return <AlertTriangle size={12} className="text-yellow-400" />
  if (severity === 4) return <Info size={12} className="text-blue-400" />
  return <AlertCircle size={12} className="text-[var(--text-muted)]" />
}

export default function ProblemsPanel() {
  const problems = useEditorStore((s) => s.problems)
  const openFileAtPosition = useEditorStore((s) => s.openFileAtPosition)

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      <div className="px-4 py-2 text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase border-b border-[var(--border)] shrink-0">
        Problems ({problems.length})
      </div>

      <div className="flex-1 overflow-y-auto">
        {problems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
            No problems
          </div>
        ) : (
          problems.map((problem, index) => {
            const parts = problem.filePath.replace(/\\/g, '/').split('/')
            const fileName = parts.pop() || problem.filePath
            const dir = parts.slice(-2).join('/')

            return (
              <button
                key={`${problem.filePath}:${problem.line}:${problem.column}:${index}`}
                onClick={() => {
                  void openFileAtPosition(problem.filePath, problem.line, problem.column)
                }}
                className="w-full text-left px-3 py-2 border-b border-[var(--border)]/40 hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <SeverityIcon severity={problem.severity} />
                  <span className="font-medium text-[var(--text-primary)]">{fileName}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">:{problem.line}</span>
                  <span className="ml-auto text-[10px] text-[var(--text-muted)]">
                    {severityLabel(problem.severity)}
                  </span>
                </div>
                {dir && <div className="pl-4 text-[10px] text-[var(--text-muted)] truncate">{dir}</div>}
                <div className="pl-4 text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                  {problem.message}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
