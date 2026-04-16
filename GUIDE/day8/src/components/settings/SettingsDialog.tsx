/**
 * Day 8: SettingsDialog 重构——新增 System Prompt、Max Iterations、Temperature 配置。
 *
 * 设计升级：统一设计语言，入场动画。
 */

import { useState, useEffect, useCallback } from "react"
import { X, Eye, EyeOff, Settings } from "lucide-react"

interface Props {
  isOpen: boolean
  onClose: () => void
}

interface SettingsForm {
  apiKey: string
  baseURL: string
  model: string
  systemPrompt: string
  maxIterations: number
  temperature: number
}

const DEFAULTS: SettingsForm = {
  apiKey: "",
  baseURL: "",
  model: "",
  systemPrompt: "",
  maxIterations: 10,
  temperature: 0.7,
}

export default function SettingsDialog({ isOpen, onClose }: Props) {
  const [form, setForm] = useState<SettingsForm>(DEFAULTS)
  const [showApiKey, setShowApiKey] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadSettings = useCallback(async () => {
    try {
      const cfg = await window.api.getChatSettings()
      if (cfg) setForm({ ...DEFAULTS, ...cfg })
    } catch { /* 无配置时保持默认值 */ }
  }, [])

  useEffect(() => {
    if (isOpen) { loadSettings(); setShowApiKey(false) }
  }, [isOpen, loadSettings])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.api.updateChatSettings(form as any)
      onClose()
    } finally { setSaving(false) }
  }

  const update = (key: keyof SettingsForm, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  // 输入框公共样式
  const inputClass = `w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)]
    rounded-md px-3 py-1.5 text-sm text-[var(--color-fg-primary)]
    placeholder-[var(--color-fg-muted)] focus:outline-none focus:border-[var(--color-accent)]
    transition-base`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]
                      rounded-xl shadow-2xl overflow-hidden animate-fade-in-scale">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-fg-primary)]">
            <Settings className="w-4 h-4 text-[var(--color-accent)]" />
            <span>设置</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-fg-muted)]
                       hover:text-[var(--color-fg-primary)] transition-base cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 表单内容（可滚动） */}
        <div className="px-5 py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          {/* ── API 连接 ── */}
          <div className="text-[11px] uppercase tracking-widest text-[var(--color-fg-muted)] font-semibold">
            API 连接
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs text-[var(--color-fg-secondary)] mb-1.5">API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={form.apiKey}
                onChange={(e) => update("apiKey", e.target.value)}
                placeholder="sk-..."
                className={`${inputClass} pr-9`}
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-fg-muted)]
                           hover:text-[var(--color-fg-secondary)] transition-base cursor-pointer"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-xs text-[var(--color-fg-secondary)] mb-1.5">Base URL</label>
            <input
              type="text"
              value={form.baseURL}
              onChange={(e) => update("baseURL", e.target.value)}
              placeholder="https://api.openai.com/v1"
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-[var(--color-fg-muted)]">
              留空使用默认端点。支持兼容 OpenAI 格式的第三方 API。
            </p>
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs text-[var(--color-fg-secondary)] mb-1.5">模型</label>
            <input
              type="text"
              value={form.model}
              onChange={(e) => update("model", e.target.value)}
              placeholder="gpt-4o"
              className={inputClass}
            />
          </div>

          {/* ── Agent 行为 ── */}
          <div className="text-[11px] uppercase tracking-widest text-[var(--color-fg-muted)] font-semibold mt-2">
            Agent 行为
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-xs text-[var(--color-fg-secondary)] mb-1.5">
              System Prompt <span className="text-[var(--color-fg-muted)]">（可选）</span>
            </label>
            <textarea
              value={form.systemPrompt}
              onChange={(e) => update("systemPrompt", e.target.value)}
              placeholder="可以在此添加额外的系统指令，会追加到默认系统提示词后面…"
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Max Iterations */}
          <div>
            <label className="block text-xs text-[var(--color-fg-secondary)] mb-1.5">
              最大迭代轮次
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={30}
                value={form.maxIterations}
                onChange={(e) => update("maxIterations", parseInt(e.target.value))}
                className="flex-1 accent-[var(--color-accent)]"
              />
              <span className="text-sm font-mono text-[var(--color-fg-primary)] w-8 text-right">
                {form.maxIterations}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-fg-muted)]">
              Agent 单次对话中调用工具的最大循环次数。
            </p>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-xs text-[var(--color-fg-secondary)] mb-1.5">
              Temperature
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={200}
                value={Math.round(form.temperature * 100)}
                onChange={(e) => update("temperature", parseInt(e.target.value) / 100)}
                className="flex-1 accent-[var(--color-accent)]"
              />
              <span className="text-sm font-mono text-[var(--color-fg-primary)] w-10 text-right">
                {form.temperature.toFixed(2)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-fg-muted)]">
              控制模型输出的随机性。0 = 确定性，2 = 最大随机。
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm text-[var(--color-fg-secondary)]
                       hover:bg-[var(--color-bg-hover)] transition-base cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-md text-sm bg-[var(--color-accent)]
                       hover:bg-[var(--color-accent-hover)] disabled:opacity-50
                       text-white font-medium transition-base cursor-pointer"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  )
}
