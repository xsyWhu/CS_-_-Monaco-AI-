/// <reference types="vite/client" />

declare module '*.css'

interface TerminalCommandResult {
	stdout: string
	stderr: string
	code: number
}

interface RendererApi {
	runCommand: (command: string) => Promise<TerminalCommandResult>
}

declare global {
	interface Window {
		api: RendererApi
	}
}
