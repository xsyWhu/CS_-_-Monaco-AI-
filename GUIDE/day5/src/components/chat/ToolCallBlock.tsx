/**
 * Day 5: ToolCallBlock 组件——展示单次工具调用的状态与结果。
 *
 * 设计：
 * - 顶部栏显示工具名称 + 状态徽章，点击可折叠/展开详情。
 * - 展开后显示格式化的参数 JSON 和执行结果。
 * - 三种状态：running（旋转加载）/ completed（绿色勾）/ error（红色叉）。
 */

import { useState } from 'react'
import { Wrench, ChevronRight, ChevronDown, Loader2, Check, X } from 'lucide-react'

interface Props {
  toolCall: ToolCallInfo
}

// 每种状态对应的颜色和图标。
const STATUS_CONFIG = {
  running: {
    label: '执行中',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    Icon: Loader2,
    spin: true,
  },
  completed: {
    label: '完成',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    Icon: Check,
    spin: false,
  },
  error: {
    label: '失败',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    Icon: X,
    spin: false,
  },
} as const

export default function ToolCallBlock({ toolCall }: Props) {
  const [expanded, setExpanded] = useState(false)
  const config = STATUS_CONFIG[toolCall.status]

  // 尝试格式化 JSON 参数，失败时保留原始字符串。
  let formattedArgs = toolCall.args ?? ''
  try {
    if (formattedArgs) {
      formattedArgs = JSON.stringify(JSON.parse(formattedArgs), null, 2)
    }
  } catch {
    // keep raw
  }

  return (
    <div className="rounded border border-[var(--border)] overflow-hidden text-xs my-1">
      {/* 折叠栏头部 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown size={11} className="text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRight size={11} className="text-gray-500 flex-shrink-0" />
        )}
        <Wrench size={11} className="text-gray-400 flex-shrink-0" />
        {/* 工具名称 */}
        <span className="font-mono font-medium text-gray-200 truncate flex-1">
          {toolCall.name}
        </span>
        {/* 状态徽章 */}
        <span
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${config.color} ${config.bgColor} flex-shrink-0`}
        >
          <config.Icon
            size={10}
            className={config.spin ? 'animate-spin' : ''}
          />
          {config.label}
        </span>
      </button>

      {/* 折叠内容 */}
      {expanded && (
        <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
          {/* 参数区 */}
          {formattedArgs && (
            <div className="px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">
                参数
              </p>
              <pre className="bg-[var(--bg-primary)] rounded p-2 overflow-x-auto text-gray-400 whitespace-pre-wrap break-all leading-relaxed">
                {formattedArgs}
              </pre>
            </div>
          )}
          {/* 结果区（工具执行完毕后才显示） */}
          {toolCall.result != null && (
            <div className="px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">
                结果
              </p>
              <pre className="bg-[var(--bg-primary)] rounded p-2 overflow-x-auto text-gray-400 whitespace-pre-wrap break-all leading-relaxed max-h-[200px]">
                {toolCall.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
