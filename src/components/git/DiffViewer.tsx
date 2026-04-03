interface Props {
  diff: string
}

export default function DiffViewer({ diff }: Props) {
  if (!diff.trim()) {
    return (
      <div className="px-3 py-4 text-xs text-[var(--text-muted)] text-center">
        No diff available
      </div>
    )
  }

  const lines = diff.split('\n')

  return (
    <div className="overflow-auto max-h-[400px] text-xs font-mono">
      {lines.map((line, i) => {
        let textColor = 'text-[var(--text-secondary)]'
        let bgColor = ''

        if (line.startsWith('+++') || line.startsWith('---')) {
          textColor = 'text-[var(--text-primary)] font-bold'
        } else if (line.startsWith('+')) {
          textColor = 'text-[var(--success)]'
          bgColor = 'bg-[var(--success)]/10'
        } else if (line.startsWith('-')) {
          textColor = 'text-[var(--error)]'
          bgColor = 'bg-[var(--error)]/10'
        } else if (line.startsWith('@@')) {
          textColor = 'text-[var(--accent)]'
          bgColor = 'bg-[var(--accent)]/5'
        } else if (line.startsWith('diff ') || line.startsWith('index ')) {
          textColor = 'text-[var(--text-muted)]'
        }

        return (
          <div key={i} className={`px-3 py-px leading-5 ${bgColor}`}>
            <span className="text-[var(--text-muted)] select-none inline-block w-8 text-right mr-2 opacity-50">
              {i + 1}
            </span>
            <span className={textColor}>{line || ' '}</span>
          </div>
        )
      })}
    </div>
  )
}
