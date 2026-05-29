import { create } from 'zustand'
import { useEditorStore } from './editor.store'

export interface DebugBreakpoint {
  filePath: string
  line: number
}

export interface DebugStackFrame {
  level: number
  func: string
  file?: string
  fullname?: string
  line?: number
}

export interface DebugVariable {
  name: string
  value: string
}

export interface DebugLocation {
  filePath: string
  line: number
  column: number
}

export interface DebugSessionState {
  status: 'idle' | 'starting' | 'running' | 'stopped' | 'ended' | 'error'
  sourceFile: string | null
  executablePath: string | null
  currentLocation: DebugLocation | null
  breakpoints: DebugBreakpoint[]
  stackFrames: DebugStackFrame[]
  variables: DebugVariable[]
  output: string[]
  error: string | null
}

interface DebugState {
  session: DebugSessionState
  bridgeReady: boolean

  initializeDebugBridge: () => void
  startDebugForFile: (filePath: string) => Promise<void>
  stopDebug: () => Promise<void>
  continueDebug: () => Promise<void>
  stepOverDebug: () => Promise<void>
  stepIntoDebug: () => Promise<void>
  stepOutDebug: () => Promise<void>
  pauseDebug: () => Promise<void>
  toggleBreakpoint: (filePath: string, line: number) => Promise<void>
  setBreakpointsForFile: (filePath: string, lines: number[]) => Promise<void>
}

const initialSession: DebugSessionState = {
  status: 'idle',
  sourceFile: null,
  executablePath: null,
  currentLocation: null,
  breakpoints: [],
  stackFrames: [],
  variables: [],
  output: [],
  error: null,
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/').toLowerCase()
}

function appendOutput(output: string[], lines: string[]): string[] {
  return [...output, ...lines].slice(-200)
}

let bridgeInitialized = false

export const useDebugStore = create<DebugState>((set, get) => ({
  session: initialSession,
  bridgeReady: false,

  initializeDebugBridge: () => {
    if (bridgeInitialized) return
    bridgeInitialized = true

    window.api.onDebugState((state) => {
      set({ session: state as DebugSessionState })
    })

    window.api.onDebugOutput((lines) => {
      set((state) => ({
        session: {
          ...state.session,
          output: appendOutput(state.session.output, lines),
        },
      }))
    })

    window.api.onDebugLocation((location) => {
      set((state) => ({
        session: {
          ...state.session,
          currentLocation: location,
          status: 'stopped',
        },
      }))
    })

    set({ bridgeReady: true })
  },

  startDebugForFile: async (filePath) => {
    const state = get()
    const breakpoints = state.session.breakpoints.filter(
      (bp) => normalizePath(bp.filePath) === normalizePath(filePath),
    )
    const session = (await window.api.startDebug(filePath, breakpoints)) as DebugSessionState
    set({ session })
  },

  stopDebug: async () => {
    await window.api.stopDebug()
  },

  continueDebug: async () => {
    await window.api.continueDebug()
  },

  stepOverDebug: async () => {
    await window.api.stepOverDebug()
  },

  stepIntoDebug: async () => {
    await window.api.stepIntoDebug()
  },

  stepOutDebug: async () => {
    await window.api.stepOutDebug()
  },

  pauseDebug: async () => {
    await window.api.pauseDebug()
  },

  toggleBreakpoint: async (filePath, line) => {
    const session = (await window.api.toggleDebugBreakpoint(filePath, line)) as DebugSessionState
    set({ session })
  },

  setBreakpointsForFile: async (filePath, lines) => {
    const remaining = get().session.breakpoints.filter(
      (bp) => normalizePath(bp.filePath) !== normalizePath(filePath),
    )
    const updated = [
      ...remaining,
      ...lines.map((line) => ({ filePath, line })),
    ]
    const session = (await window.api.setDebugBreakpoints(updated)) as DebugSessionState
    set({ session })
  },
}))

export function getDebugBreakpointsForFile(filePath: string): number[] {
  const session = useDebugStore.getState().session
  return session.breakpoints
    .filter((bp) => normalizePath(bp.filePath) === normalizePath(filePath))
    .map((bp) => bp.line)
}

export function initializeDebugBridge(): void {
  useDebugStore.getState().initializeDebugBridge()
}

export function getDebugActiveLocation(): DebugLocation | null {
  return useDebugStore.getState().session.currentLocation
}
