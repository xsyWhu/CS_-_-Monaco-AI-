import { create } from 'zustand'
import type { FileTreeNode } from '../types/editor.types'

const WORKSPACE_KEY = 'agent-ide.workspace.path.v1'
const RECENT_WORKSPACES_KEY = 'agent-ide.recent.workspaces.v1'

function loadRecentWorkspaces(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_WORKSPACES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function saveRecentWorkspaces(workspaces: string[]): void {
  try {
    localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(workspaces.slice(0, 10)))
  } catch {
    // Ignore storage errors
  }
}

export function getSavedWorkspacePath(): string | null {
  try {
    return localStorage.getItem(WORKSPACE_KEY)
  } catch {
    return null
  }
}

function saveWorkspacePath(path: string | null): void {
  try {
    if (path) {
      localStorage.setItem(WORKSPACE_KEY, path)
    } else {
      localStorage.removeItem(WORKSPACE_KEY)
    }
  } catch {
    // Ignore storage errors
  }
}

interface FileTreeState {
  rootPath: string | null
  entries: FileTreeNode[]
  expandedDirs: Set<string>
  selectedPath: string | null
  recentWorkspaces: string[]

  openFolder: () => Promise<void>
  selectFile: () => Promise<string | null>
  setRootPath: (path: string) => Promise<void>
  addRecentWorkspace: (path: string) => void
  loadChildren: (dirPath: string) => Promise<void>
  toggleDirectory: (path: string) => void
  setSelectedPath: (path: string | null) => void
  refreshTree: () => Promise<void>
  collapseAll: () => void
  createFile: (dirPath: string, name: string) => Promise<void>
  createFolder: (dirPath: string, name: string) => Promise<void>
  deleteEntry: (path: string) => Promise<void>
  renameEntry: (oldPath: string, newPath: string) => Promise<void>
}

function updateNodeInTree(
  nodes: FileTreeNode[],
  targetPath: string,
  updater: (node: FileTreeNode) => FileTreeNode
): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) return updater(node)
    if (node.children) {
      return { ...node, children: updateNodeInTree(node.children, targetPath, updater) }
    }
    return node
  })
}

function sortEntries(items: FileTreeNode[]): FileTreeNode[] {
  return [...items].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
}

async function fetchDirectoryEntries(dirPath: string): Promise<FileTreeNode[]> {
  const items = await window.api.readDirectory(dirPath)
  return sortEntries(
    items.map((item) => ({
      name: item.name,
      path: item.path,
      isDirectory: item.isDirectory,
      isFile: item.isFile,
      size: item.size,
      modifiedTime: item.modifiedTime,
    }))
  )
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  rootPath: null,
  entries: [],
  expandedDirs: new Set<string>(),
  selectedPath: null,
  recentWorkspaces: loadRecentWorkspaces(),

  openFolder: async () => {
    const selected = await window.api.selectDirectory()
    if (selected) await get().setRootPath(selected)
  },

  selectFile: async () => {
    return await window.api.selectFile()
  },

  setRootPath: async (path) => {
    const entries = await fetchDirectoryEntries(path)
    saveWorkspacePath(path)
    const recentWorkspaces = [path, ...get().recentWorkspaces.filter((item) => item !== path)].slice(0, 10)
    saveRecentWorkspaces(recentWorkspaces)
    set({ rootPath: path, entries, expandedDirs: new Set(), selectedPath: null, recentWorkspaces })
  },

  addRecentWorkspace: (path) => {
    const recentWorkspaces = [path, ...get().recentWorkspaces.filter((item) => item !== path)].slice(0, 10)
    saveRecentWorkspaces(recentWorkspaces)
    set({ recentWorkspaces })
  },

  loadChildren: async (dirPath) => {
    const { entries } = get()
    set({ entries: updateNodeInTree(entries, dirPath, (n) => ({ ...n, isLoading: true })) })

    try {
      const children = await fetchDirectoryEntries(dirPath)
      set((state) => ({
        entries: updateNodeInTree(state.entries, dirPath, (n) => ({
          ...n,
          children,
          isLoading: false,
        })),
      }))
    } catch {
      set((state) => ({
        entries: updateNodeInTree(state.entries, dirPath, (n) => ({ ...n, isLoading: false })),
      }))
    }
  },

  toggleDirectory: (path) => {
    const next = new Set(get().expandedDirs)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    set({ expandedDirs: next })
  },

  setSelectedPath: (path) => set({ selectedPath: path }),

  refreshTree: async () => {
    const { rootPath } = get()
    if (!rootPath) return
    const entries = await fetchDirectoryEntries(rootPath)
    set({ entries })
  },

  collapseAll: () => set({ expandedDirs: new Set() }),

  createFile: async (dirPath, name) => {
    const sep = dirPath.includes('\\') ? '\\' : '/'
    await window.api.writeFile(`${dirPath}${sep}${name}`, '')
    if (dirPath === get().rootPath) {
      await get().refreshTree()
    } else {
      await get().loadChildren(dirPath)
    }
  },

  createFolder: async (dirPath, name) => {
    const sep = dirPath.includes('\\') ? '\\' : '/'
    await window.api.createDirectory(`${dirPath}${sep}${name}`)
    if (dirPath === get().rootPath) {
      await get().refreshTree()
    } else {
      await get().loadChildren(dirPath)
    }
  },

  deleteEntry: async (path) => {
    await window.api.deleteFile(path)
    await get().refreshTree()
  },

  renameEntry: async (oldPath, newPath) => {
    await window.api.renameFile(oldPath, newPath)
    await get().refreshTree()
  },
}))
