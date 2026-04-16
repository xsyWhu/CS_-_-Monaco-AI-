/// <reference types="vite/client" />

declare module '*.css'

interface TerminalCommandResult {
	stdout: string
	stderr: string
	code: number
}

interface FileTreeNode {
	name: string
	path: string
	relativePath: string
	type: 'file' | 'directory'
	children?: FileTreeNode[]
}

interface WorkspaceTreeResult {
	workspaceRoot: string
	tree: FileTreeNode[]
}

interface RendererApi {
	runCommand: (command: string) => Promise<TerminalCommandResult>
	getFileTree: () => Promise<WorkspaceTreeResult>
	readFile: (filePath: string) => Promise<string>
}

declare global {
	interface Window {
		api: RendererApi
	}
}
