import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings.store'
import type { ProviderSettings } from '@/types/agent.types'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const defaultProvider: ProviderSettings = {
  id: 'default',
  name: '',
  apiKey: '',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4o',
}

export default function SettingsDialog({ isOpen, onClose }: Props) {
  const currentProvider = useSettingsStore((s) => s.provider)
  const updateProvider = useSettingsStore((s) => s.updateProvider)
  const autoSaveMode = useSettingsStore((s) => s.autoSaveMode)
  const autoSaveDelay = useSettingsStore((s) => s.autoSaveDelay)
  const formatOnSave = useSettingsStore((s) => s.formatOnSave)
  const setAutoSaveMode = useSettingsStore((s) => s.setAutoSaveMode)
  const setAutoSaveDelay = useSettingsStore((s) => s.setAutoSaveDelay)
  const setFormatOnSave = useSettingsStore((s) => s.setFormatOnSave)

  const [form, setForm] = useState<ProviderSettings>(defaultProvider)
  const [showApiKey, setShowApiKey] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setForm(currentProvider ?? defaultProvider)
      setShowApiKey(false)
    }
  }, [isOpen, currentProvider])

  if (!isOpen) return null

  const updateField = (field: keyof ProviderSettings, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProvider(form)
      onClose()
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            LLM Provider Configuration
          </h3>

          <div className="space-y-3">
            <FormField label="Provider Name">
              <input
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g. OpenAI"
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
              />
            </FormField>

            <FormField label="API Base URL">
              <input
                value={form.baseURL}
                onChange={(e) => updateField('baseURL', e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
              />
            </FormField>

            <FormField label="API Key">
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={form.apiKey}
                  onChange={(e) => updateField('apiKey', e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </FormField>

            <FormField label="Model">
              <input
                value={form.model}
                onChange={(e) => updateField('model', e.target.value)}
                placeholder="gpt-4o"
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
              />
            </FormField>
          </div>

          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider pt-2">
            Editor
          </h3>
          <div className="space-y-3">
            <FormField label="Auto Save">
              <select
                value={autoSaveMode}
                onChange={(e) =>
                  setAutoSaveMode(e.target.value as 'off' | 'afterDelay' | 'onFocusChange')
                }
                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
              >
                <option value="off">Off</option>
                <option value="afterDelay">After Delay</option>
                <option value="onFocusChange">On Focus Change</option>
              </select>
            </FormField>

            {autoSaveMode === 'afterDelay' && (
              <FormField label="Auto Save Delay (ms)">
                <input
                  type="number"
                  min={300}
                  max={10000}
                  step={100}
                  value={autoSaveDelay}
                  onChange={(e) => setAutoSaveDelay(Number(e.target.value))}
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
                />
              </FormField>
            )}

            <FormField label="Format on Save">
              <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={formatOnSave}
                  onChange={(e) => setFormatOnSave(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] bg-[var(--bg-tertiary)] accent-[var(--accent)]"
                />
                <span>Automatically format the current file before saving</span>
              </label>
            </FormField>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-[var(--accent)] text-[var(--bg-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-muted)] mb-1.5">{label}</label>
      {children}
    </div>
  )
}
