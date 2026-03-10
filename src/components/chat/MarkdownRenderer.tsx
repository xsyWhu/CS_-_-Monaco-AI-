import { useState, useCallback } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Check } from 'lucide-react'

interface Props {
  content: string
}

function CodeBlock({ className, children }: { className?: string; children: string }) {
  const [copied, setCopied] = useState(false)
  const language = className?.replace('language-', '') || ''

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [children])

  return (
    <div className="relative group rounded-md overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-1 bg-[var(--bg-tertiary)] text-[10px] text-[var(--text-muted)]">
        <span>{language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--text-primary)]"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="bg-[var(--bg-secondary)] p-3 overflow-x-auto text-[var(--text-primary)]">
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}

export default function MarkdownRenderer({ content }: Props) {
  const components: Components = {
    code({ className, children, ...rest }) {
      const code = String(children).replace(/\n$/, '')
      const hasLanguage = Boolean(className)
      const isMultiline = code.includes('\n')

      if (hasLanguage || isMultiline) {
        return <CodeBlock className={className}>{code}</CodeBlock>
      }

      return (
        <code
          className="bg-[var(--bg-tertiary)] text-[var(--accent)] rounded px-1 py-0.5 text-[0.85em]"
          {...rest}
        >
          {children}
        </code>
      )
    },
    pre({ children }) {
      return <>{children}</>
    },
    a({ href, children }) {
      return (
        <a
          href={href}
          className="text-[var(--accent)] underline hover:text-[var(--accent-hover)]"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      )
    },
    ul({ children }) {
      return <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
    },
    ol({ children }) {
      return <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
    },
    table({ children }) {
      return (
        <div className="overflow-x-auto my-2">
          <table className="w-full border-collapse text-sm">{children}</table>
        </div>
      )
    },
    thead({ children }) {
      return <thead className="bg-[var(--bg-tertiary)]">{children}</thead>
    },
    th({ children }) {
      return (
        <th className="border border-[var(--border)] px-3 py-1.5 text-left font-medium text-[var(--text-primary)]">
          {children}
        </th>
      )
    },
    td({ children }) {
      return (
        <td className="border border-[var(--border)] px-3 py-1.5 text-[var(--text-secondary)]">
          {children}
        </td>
      )
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-2 border-[var(--accent)] pl-3 my-2 text-[var(--text-secondary)] italic">
          {children}
        </blockquote>
      )
    },
    h1({ children }) {
      return <h1 className="text-xl font-bold mt-4 mb-2 text-[var(--text-primary)]">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="text-lg font-bold mt-3 mb-2 text-[var(--text-primary)]">{children}</h2>
    },
    h3({ children }) {
      return (
        <h3 className="text-base font-semibold mt-2 mb-1 text-[var(--text-primary)]">
          {children}
        </h3>
      )
    },
    p({ children }) {
      return <p className="my-1.5 leading-relaxed">{children}</p>
    },
    hr() {
      return <hr className="border-[var(--border)] my-4" />
    },
  }

  return (
    <div className="markdown-content text-sm text-[var(--text-primary)] break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
