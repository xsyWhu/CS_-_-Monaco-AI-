/**
 * Day 8: ToolCallBlock 组件——修复 CSS 变量，使用统一设计语言。
 */

import { useState } from 'react'
import { Wrench, ChevronRight, ChevronDown, Loader2, Check, X } from 'lucide-react'

interface Props {
  toolCall: ToolCallInfo
}

const STATUS_CONFIG = {
  running: {
    label: '执行中',
    color: 'text-[var(--color-accent)]',
    bgColor: 'bg-[var(--color-accent-muted)]',
    Icon: Loader2,
    spin: true,
  },
  completed: {
    label: '完成',
    color: 'text-[var(--color-success)]',
    bgColor: 'bg-[rgba(74,222,128,0.08)]',
    Icon: Check,
    spin: false,
  },
  error: {
    label: '失败',
    color: 'text-[var(--color-error)]',
    bgColor: 'bg-[rgba(248,113,113,0.08)]',
    Icon: X,
    spin: false,
  },
} as const

export default function ToolCallBlock({ toolCall }: Props) {
  const [expanded, setExpanded] = useState(false)
  const config = STATUS_CONFIG[toolCall.status]

  let formattedArgs = toolCall.args ?? ''
  try {
    if (formattedArgs) formattedArgs = JSON.stringify(JSON.parse(formattedArgs), null, 2)
  } catch { /* keep raw */ }

  return (
    <div className="rounded-md border border-[var(--color-border)] overflow-hidden text-xs my-1 animate-fade-in">
      {/* 折叠栏头部 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--color-bg-hover)]
                   transition-base text-left cursor-pointer"
      >
        {expanded ? (
          <ChevronDown size={11} className="text-[var(--color-fg-muted)] flex-shrink-0" />
        ) : (
          <ChevronRight size={11} className="text-[var(--color-fg-muted)] flex-shrink-0" />
        )}
        <Wrench size={11} className="text-[var(--color-fg-muted)] flex-shrink-0" />
        <span className="font-mono font-medium text-[var(--color-fg-secondary)] truncate flex-1">
          {toolCall.name}
        </span>
        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${config.color} ${config.bgColor} flex-shrink-0`}>
          <config.Icon size={10} className={config.spin ? 'animate-spin' : ''} />
          {config.label}
        </span>
      </button>

      {/* 折叠内容 */}
      {expanded && (
        <div className="border-t border-[var(--color-border-subtle)] divide-y divide-[var(--color-border-subtle)] animate-fade-in">
          {formattedArgs && (
            <div className="px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-fg-muted)] mb-1.5">参数</p>
              <pre className="bg-[var(--color-bg-primary)] rounded p-2 overflow-x-auto text-[var(--color-fg-secondary)]
                              whitespace-pre-wrap break-all leading-relaxed text-[11px]">
                {formattedArgs}
              </pre>
            </div>
          )}
          {toolCall.result != null && (
            <div className="px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-fg-muted)] mb-1.5">结果</p>
              <pre className="bg-[var(--color-bg-primary)] rounded p-2 overflow-x-auto text-[var(--color-fg-secondary)]
                              whitespace-pre-wrap break-all leading-relaxed max-h-[200px] text-[11px]">
                {toolCall.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
