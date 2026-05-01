import { useCallback, useMemo } from 'react'
import { Search, CaseSensitive, Regex, File, Filter, Loader2 } from 'lucide-react'
import { useSearchStore } from '@/stores/search.store'
import { useFileTreeStore } from '@/stores/file-tree.store'
import SearchResultItem from './SearchResult'

export default function SearchPanel() {
  const query = useSearchStore((s) => s.query)
  const results = useSearchStore((s) => s.results)
  const fileResults = useSearchStore((s) => s.fileResults)
  const loading = useSearchStore((s) => s.loading)
  const searchType = useSearchStore((s) => s.searchType)
  const options = useSearchStore((s) => s.options)
  const setQuery = useSearchStore((s) => s.setQuery)
  const setSearchType = useSearchStore((s) => s.setSearchType)
  const setOptions = useSearchStore((s) => s.setOptions)
  const search = useSearchStore((s) => s.search)

  const rootPath = useFileTreeStore((s) => s.rootPath)

  const handleSearch = useCallback(() => {
    if (!rootPath || !query.trim()) return
    search(rootPath)
  }, [rootPath, query, search])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const displayResults = searchType === 'content' ? results : fileResults
  const resultCount = displayResults.length
  const groupedContentResults = useMemo(() => {
    if (searchType !== 'content') return []

    const groups = new Map<string, typeof results>()
    for (const result of results) {
      const list = groups.get(result.filePath) ?? []
      list.push(result)
      groups.set(result.filePath, list)
    }

    return Array.from(groups.entries()).map(([filePath, items]) => ({ filePath, items }))
  }, [results, searchType])

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      {/* Search controls */}
      <div className="p-3 space-y-2 border-b border-[var(--border)]">
        {/* Search input */}
        <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded border border-[var(--border)] focus-within:border-[var(--accent)] transition-colors">
          <Search size={14} className="ml-2 text-[var(--text-muted)] flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={searchType === 'content' ? 'Search in files...' : 'Search file names...'}
            className="flex-1 bg-transparent px-2 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none min-w-0"
          />
        </div>

        {/* Options */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setSearchType(searchType === 'content' ? 'fileName' : 'content')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              searchType === 'fileName'
                ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
            title="Toggle file name search"
          >
            <File size={12} />
            File name
          </button>

          {searchType === 'content' && (
            <>
              <button
                onClick={() => setOptions({ caseSensitive: !options.caseSensitive })}
                className={`p-1.5 rounded transition-colors ${
                  options.caseSensitive
                    ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
                title="Match case"
              >
                <CaseSensitive size={14} />
              </button>
              <button
                onClick={() => setOptions({ regex: !options.regex })}
                className={`p-1.5 rounded transition-colors ${
                  options.regex
                    ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
                title="Use regular expression"
              >
                <Regex size={14} />
              </button>
            </>
          )}
        </div>

        {/* File filter */}
        {searchType === 'content' && (
          <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded border border-[var(--border)] focus-within:border-[var(--accent)] transition-colors">
            <Filter size={12} className="ml-2 text-[var(--text-muted)] flex-shrink-0" />
            <input
              value={options.filePattern}
              onChange={(e) => setOptions({ filePattern: e.target.value })}
              placeholder="File filter (e.g. *.ts, src/**)"
              className="flex-1 bg-transparent px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none min-w-0"
            />
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-[var(--accent)]" />
          </div>
        ) : resultCount > 0 ? (
          <>
            <div className="px-3 py-1.5 text-xs text-[var(--text-muted)] sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--border)]/50 z-10">
              {resultCount} result{resultCount !== 1 ? 's' : ''} found
            </div>
            <div>
              {searchType === 'content'
                ? groupedContentResults.map((group) => {
                    const parts = group.filePath.replace(/\\/g, '/').split('/')
                    const fileName = parts.pop() || group.filePath
                    const dir = parts.slice(-2).join('/')

                    return (
                      <div key={group.filePath} className="border-b border-[var(--border)]/30">
                        <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)] flex items-center justify-between">
                          <span className="truncate">{fileName}</span>
                          <span>{group.items.length} matches</span>
                        </div>
                        <div className="px-3 pb-2">
                          {dir && (
                            <div className="text-[10px] text-[var(--text-muted)] truncate mb-1">
                              {dir}
                            </div>
                          )}
                          {group.items.map((r, i) => (
                            <SearchResultItem
                              key={`${r.filePath}:${r.line}:${i}`}
                              result={r}
                              type="content"
                              query={query}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })
                : fileResults.map((r, i) => (
                    <SearchResultItem
                      key={`${r.filePath}:${i}`}
                      result={r}
                      type="fileName"
                      query={query}
                    />
                  ))}
            </div>
          </>
        ) : query.trim() ? (
          <div className="flex items-center justify-center py-8 text-sm text-[var(--text-muted)]">
            No results found
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)]">
            <Search size={24} className="mb-2 opacity-40" />
            <p className="text-sm">Enter a search term</p>
          </div>
        )}
      </div>
    </div>
  )
}
