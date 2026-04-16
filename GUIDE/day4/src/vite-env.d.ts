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

// Day 4: Chat 消息类型。
interface ChatMessageData {
	id: string
	role: 'user' | 'assistant' | 'system'
	content: string
	timestamp: number
	isStreaming?: boolean
}

interface RendererApi {
	// Day 2~3
	runCommand: (command: string) => Promise<TerminalCommandResult>
	getFileTree: () => Promise<WorkspaceTreeResult>
	readFile: (filePath: string) => Promise<string>

	// Day 4: Chat
	sendChatMessage: (message: string) => Promise<void>
	getChatSettings: () => Promise<{ apiKey: string; baseURL: string; model: string } | null>
	updateChatSettings: (config: { apiKey: string; baseURL: string; model: string }) => Promise<void>
	clearChat: () => Promise<void>
	onChatStream: (callback: (data: { token: string }) => void) => () => void
	onChatComplete: (callback: (data: { message: string }) => void) => () => void
	onChatError: (callback: (data: { error: string }) => void) => () => void
}

declare global {
	interface Window {
		api: RendererApi
	}
}
