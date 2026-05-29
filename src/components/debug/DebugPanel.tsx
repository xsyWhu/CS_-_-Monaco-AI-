import { BugPlay, Pause, Play, Square, StepBack, StepForward, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useEditorStore } from '@/stores/editor.store'
import { useDebugStore, getDebugBreakpointsForFile } from '@/stores/debug.store'
import { isCppFilePath } from '@/services/editor/editor-service'

function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <div className="px-4 py-2 border-b border-[var(--border)] shrink-0 flex items-center justify-between">
      <div className="sidebar-group-title">{title}</div>
      {typeof count === 'number' && (
        <div className="text-[10px] normal-case text-[var(--text-muted)]">{count}</div>
      )}
    </div>
  )
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      title={label}
    >
      <Icon className="action-icon" />
    </button>
  )
}

export default function DebugPanel() {
  const tabs = useEditorStore((s) => s.tabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null
  const debugState = useDebugStore((s) => s.session)
  const startDebugForFile = useDebugStore((s) => s.startDebugForFile)
  const stopDebug = useDebugStore((s) => s.stopDebug)
  const continueDebug = useDebugStore((s) => s.continueDebug)
  const stepOverDebug = useDebugStore((s) => s.stepOverDebug)
  const stepIntoDebug = useDebugStore((s) => s.stepIntoDebug)
  const stepOutDebug = useDebugStore((s) => s.stepOutDebug)
  const pauseDebug = useDebugStore((s) => s.pauseDebug)
  const toggleBreakpoint = useDebugStore((s) => s.toggleBreakpoint)

  const currentBreakpoints = activeTab ? getDebugBreakpointsForFile(activeTab.filePath) : []
  const canDebug = !!activeTab && isCppFilePath(activeTab.filePath)
  const hasSession = debugState.status !== 'idle' && debugState.status !== 'ended'
  const currentLocation = debugState.currentLocation
  const isPaused = debugState.status === 'stopped'

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      <SectionTitle title="Debugger" />

      <div className="px-4 py-2 border-b border-[var(--border)] flex flex-wrap gap-1">
        {!hasSession ? (
          <ToolbarButton
            icon={BugPlay}
            label={canDebug ? 'Start Debugging' : 'Open a C++ file first'}
            onClick={() => {
              if (!activeTab || !canDebug) return
              void startDebugForFile(activeTab.filePath).catch((error) => {
                console.error('Failed to start debugging:', error)
              })
            }}
            disabled={!canDebug}
          />
        ) : (
          <>
            <ToolbarButton
              icon={Play}
              label="Continue"
              onClick={() => {
                void continueDebug().catch((error) => {
                  console.error('Failed to continue debugging:', error)
                })
              }}
              disabled={!isPaused}
            />
            <ToolbarButton
              icon={StepForward}
              label="Step Over"
              onClick={() => {
                void stepOverDebug().catch((error) => {
                  console.error('Failed to step over:', error)
                })
              }}
              disabled={!isPaused}
            />
            <ToolbarButton
              icon={StepBack}
              label="Step Into"
              onClick={() => {
                void stepIntoDebug().catch((error) => {
                  console.error('Failed to step into:', error)
                })
              }}
              disabled={!isPaused}
            />
            <ToolbarButton
              icon={StepForward}
              label="Step Out"
              onClick={() => {
                void stepOutDebug().catch((error) => {
                  console.error('Failed to step out:', error)
                })
              }}
              disabled={!isPaused}
            />
            <ToolbarButton
              icon={Pause}
              label="Pause"
              onClick={() => {
                void pauseDebug().catch((error) => {
                  console.error('Failed to pause debugging:', error)
                })
              }}
              disabled={!hasSession}
            />
            <ToolbarButton
              icon={Square}
              label="Stop"
              onClick={() => {
                void stopDebug().catch((error) => {
                  console.error('Failed to stop debugging:', error)
                })
              }}
              disabled={!hasSession}
            />
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!activeTab ? (
          <div className="p-4 text-sm text-[var(--text-muted)]">
            Open a C++ file to start debugging.
          </div>
        ) : !canDebug ? (
          <div className="p-4 text-sm text-[var(--text-muted)]">
            Debugging is currently enabled for C++ files only.
          </div>
        ) : null}

        <div className="p-4 border-b border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Current File</div>
          <div className="text-sm text-[var(--text-primary)] break-all">{activeTab?.fileName ?? 'None'}</div>
          <div className="text-[11px] text-[var(--text-muted)] break-all">{activeTab?.filePath ?? ''}</div>
          <div className="mt-2 text-xs text-[var(--text-muted)]">
            Status: <span className="text-[var(--text-secondary)] capitalize">{debugState.status}</span>
          </div>
          {currentLocation && (
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              Stopped at: <span className="text-[var(--text-secondary)]">{currentLocation.filePath}:{currentLocation.line}</span>
            </div>
          )}
          {debugState.error && (
            <div className="mt-2 text-xs text-[var(--error)] flex items-start gap-1">
              <TriangleAlert size={12} className="shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap">{debugState.error}</span>
            </div>
          )}
        </div>

        <div className="p-4 border-b border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Breakpoints
          </div>
          {currentBreakpoints.length === 0 ? (
            <div className="text-sm text-[var(--text-muted)]">Click the editor gutter to add a breakpoint.</div>
          ) : (
            <div className="space-y-1">
              {currentBreakpoints.map((line) => (
                <button
                  key={line}
                  onClick={() => {
                    if (!activeTab) return
                    void toggleBreakpoint(activeTab.filePath, line).catch((error) => {
                      console.error('Failed to toggle breakpoint:', error)
                    })
                  }}
                  className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-[var(--bg-hover)] text-left text-sm"
                >
                  <span className="text-[var(--text-primary)]">Line {line}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Click to remove</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-b border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Call Stack
          </div>
          {debugState.stackFrames.length === 0 ? (
            <div className="text-sm text-[var(--text-muted)]">No stack frames available.</div>
          ) : (
            <div className="space-y-1">
              {debugState.stackFrames.map((frame) => (
                <div key={`${frame.level}:${frame.func}:${frame.line ?? 0}`} className="px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border)]">
                  <div className="text-sm text-[var(--text-primary)]">{frame.func}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {frame.fullname ?? frame.file ?? 'unknown'}{frame.line ? `:${frame.line}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-b border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Variables
          </div>
          {debugState.variables.length === 0 ? (
            <div className="text-sm text-[var(--text-muted)]">No variables available.</div>
          ) : (
            <div className="space-y-1">
              {debugState.variables.map((variable) => (
                <div key={variable.name} className="flex items-center justify-between gap-3 px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border)]">
                  <span className="text-sm text-[var(--text-primary)] truncate">{variable.name}</span>
                  <span className="text-sm text-[var(--text-secondary)] font-mono truncate">{variable.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Output
          </div>
          <div className="space-y-1 font-mono text-[11px] text-[var(--text-secondary)]">
            {debugState.output.length === 0 ? (
              <div className="text-sm text-[var(--text-muted)]">Debugger output will appear here.</div>
            ) : (
              debugState.output.map((line, index) => (
                <div key={`${index}-${line.slice(0, 16)}`} className="whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
