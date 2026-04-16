/**
 * Day 7: SettingsDialog —— 全局 API 设置模态框。
 *
 * 包含：
 *   - API Key（可切换显示/隐藏）
 *   - Base URL（自定义代理/兼容端点）
 *   - Model（模型名称）
 * 打开时读取当前配置，保存时写回 main 进程。
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
}

export default function SettingsDialog({ isOpen, onClose }: Props) {
  const [form, setForm] = useState<SettingsForm>({ apiKey: "", baseURL: "", model: "" })
  const [showApiKey, setShowApiKey] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── 打开时加载当前配置 ──────────────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    try {
      const cfg = await window.api.getChatSettings()
      if (cfg) setForm(cfg)
    } catch {
      // 无配置时保持空白
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadSettings()
      setShowApiKey(false)
    }
  }, [isOpen, loadSettings])

  // ── Escape 关闭 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // ── 保存 ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      await window.api.updateChatSettings(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const update = (key: keyof SettingsForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    /* 遮罩层 */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* 对话框 */}
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
            <Settings className="w-4 h-4 text-amber-400" />
            <span>设置</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 表单 */}
        <div className="px-4 py-4 flex flex-col gap-4">
          {/* API Key */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={form.apiKey}
                onChange={(e) => update("apiKey", e.target.value)}
                placeholder="sk-..."
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 pr-9 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Base URL</label>
            <input
              type="text"
              value={form.baseURL}
              onChange={(e) => update("baseURL", e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
            <p className="mt-1 text-xs text-gray-600">留空则使用默认 OpenAI 端点。</p>
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">模型</label>
            <input
              type="text"
              value={form.model}
              onChange={(e) => update("model", e.target.value)}
              placeholder="gpt-4o"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm text-gray-400 hover:bg-gray-700"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded text-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  )
}
