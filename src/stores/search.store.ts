import { create } from 'zustand'
import type { SearchResult, FileNameResult } from '@/types/electron'

interface SearchOptions {
  caseSensitive: boolean
  regex: boolean
  filePattern: string
}

interface SearchState {
  query: string
  results: SearchResult[]
  fileResults: FileNameResult[]
  loading: boolean
  searchType: 'content' | 'fileName'
  options: SearchOptions
  setQuery: (query: string) => void
  setSearchType: (type: 'content' | 'fileName') => void
  setOptions: (options: Partial<SearchOptions>) => void
  search: (rootPath: string) => Promise<void>
  clearResults: () => void
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: [],
  fileResults: [],
  loading: false,
  searchType: 'content',
  options: {
    caseSensitive: false,
    regex: false,
    filePattern: '',
  },

  setQuery: (query: string) => {
    set({ query })
  },

  setSearchType: (type: 'content' | 'fileName') => {
    set({ searchType: type, results: [], fileResults: [] })
  },

  setOptions: (options: Partial<SearchOptions>) => {
    set((state) => ({
      options: { ...state.options, ...options },
    }))
  },

  search: async (rootPath: string) => {
    const { query, searchType, options } = get()
    if (!query.trim()) return

    try {
      set({ loading: true })

      if (searchType === 'content') {
        const results = await window.api.searchFiles(rootPath, query, {
          caseSensitive: options.caseSensitive,
          regex: options.regex,
          filePattern: options.filePattern || undefined,
        })
        set({ results, loading: false })
      } else {
        const fileResults = await window.api.searchFileNames(rootPath, query)
        set({ fileResults, loading: false })
      }
    } catch (error) {
      console.error('Search failed:', error)
      set({ loading: false })
    }
  },

  clearResults: () => {
    set({ query: '', results: [], fileResults: [] })
  },
}))
