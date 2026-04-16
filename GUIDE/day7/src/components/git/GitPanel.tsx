/**
 * Day 7: GitPanel —— Git 操作面板。
 *
 * 功能：
 *   - 显示当前分支，支持切换分支。
 *   - 列出未暂存文件（unstaged），一键全部暂存。
 *   - 列出已暂存文件（staged），一键全部取消暂存（实现见 git.store）。
 *   - 填写 commit 消息后一键提交。
 *   - 查看全量 diff（展开/收起）。
 *   - 刷新按钮重新加载状态。
 */

import { useState, useEffect, useCallback } from "react"
import { GitBranch, GitCommit, RefreshCw, ChevronDown, ChevronRight, Eye } from "lucide-react"
import { useGitStore } from "../../stores/git.store"
import { useFileTreeStore } from "../../stores/file-tree.store"
import DiffViewer from "./DiffViewer"

export default function GitPanel() {
  const repoPath = useFileTreeStore((s) => s.workspaceRoot)
  const { status, branches, diff, loading, refreshStatus, refreshBranches, stageFiles, commit, checkout, getDiff } =
    useGitStore()

  const [commitMsg, setCommitMsg] = useState("")
  const [showDiff, setShowDiff] = useState(false)
  const [committing, setCommitting] = useState(false)

  // ── 加载数据 ────────────────────────────────────────────────────────────────
  const loadAll = useCallback(() => {
    if (!repoPath) return
    refreshStatus(repoPath)
    refreshBranches(repoPath)
  }, [repoPath, refreshStatus, refreshBranches])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // ── 无工作区 ────────────────────────────────────────────────────────────────
  if (!repoPath) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-500 p-4 text-center">
        请先打开工作区目录
      </div>
    )
  }

  // ── Git 不可用 ───────────────────────────────────────────────────────────────
  if (!loading && status === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-xs text-gray-500 p-4 gap-2 text-center">
        <GitBranch className="w-6 h-6 opacity-30" />
        <span>当前目录不是 Git 仓库</span>
      </div>
    )
  }

  // ── 文件分类 ────────────────────────────────────────────────────────────────
  const stagedFiles = (status?.files ?? []).filter(
    (f) => f.index !== " " && f.index !== "?" && f.index !== "!",
  )
  const unstagedFiles = (status?.files ?? []).filter(
    (f) => f.working_dir !== " " && f.working_dir !== "!",
  )

  // ── 提交 ────────────────────────────────────────────────────────────────────
  const handleCommit = async () => {
    if (!commitMsg.trim() || stagedFiles.length === 0) return
    setCommitting(true)
    try {
      await commit(repoPath, commitMsg.trim())
      setCommitMsg("")
      await refreshStatus(repoPath)
    } finally {
      setCommitting(false)
    }
  }

  // ── 暂存全部 ─────────────────────────────────────────────────────────────────
  const handleStageAll = async () => {
    const files = unstagedFiles.map((f) => f.path)
    if (files.length === 0) return
    await stageFiles(repoPath, files)
    await refreshStatus(repoPath)
  }

  // ── 查看 diff ─────────────────────────────────────────────────────────────────
  const handleToggleDiff = async () => {
    if (!showDiff) {
      await getDiff(repoPath)
    }
    setShowDiff((v) => !v)
  }

  // ── 切换分支 ─────────────────────────────────────────────────────────────────
  const handleCheckout = async (branch: string) => {
    await checkout(repoPath, branch)
    await refreshStatus(repoPath)
  }

  return (
    <div className="flex flex-col h-full text-sm overflow-hidden">
      {/* ── 顶部工具栏 ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 shrink-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">源代码管理</span>
        <button
          onClick={loadAll}
          disabled={loading}
          title="刷新"
          className="p-1 rounded hover:bg-gray-700 text-gray-400 disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── 当前分支 ── */}
      <div className="px-3 py-2 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
          <GitBranch className="w-3 h-3" />
          <span>分支</span>
        </div>
        <select
          value={status?.current ?? ""}
          onChange={(e) => handleCheckout(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-amber-500"
        >
          {branches.length > 0 ? (
            branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))
          ) : (
            <option value={status?.current ?? ""}>{status?.current ?? "（加载中）"}</option>
          )}
        </select>
        {(status?.ahead ?? 0) > 0 || (status?.behind ?? 0) > 0 ? (
          <div className="mt-1 text-xs text-gray-500">
            ↑ {status?.ahead} ↓ {status?.behind}
          </div>
        ) : null}
      </div>

      {/* ── 变更文件列表 ── */}
      <div className="flex-1 overflow-y-auto">
        {/* 未暂存 */}
        <div className="px-3 pt-2 pb-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400 font-medium">
              未暂存的更改 ({unstagedFiles.length})
            </span>
            {unstagedFiles.length > 0 && (
              <button
                onClick={handleStageAll}
                className="text-xs text-amber-400 hover:text-amber-300 px-1"
              >
                全部暂存
              </button>
            )}
          </div>
          {unstagedFiles.length === 0 ? (
            <div className="text-xs text-gray-600 py-1">无</div>
          ) : (
            unstagedFiles.map((f) => (
              <div
                key={f.path}
                className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-gray-800 group"
              >
                <span
                  className={`text-xs truncate ${f.working_dir === "?" ? "text-green-400" : "text-amber-400"}`}
                  title={f.path}
                >
                  {f.path}
                </span>
                <span className="text-xs text-gray-600 ml-1 shrink-0">
                  {f.working_dir === "?" ? "U" : f.working_dir}
                </span>
              </div>
            ))
          )}
        </div>

        {/* 已暂存 */}
        <div className="px-3 pt-2 pb-1 border-t border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400 font-medium">
              已暂存的更改 ({stagedFiles.length})
            </span>
          </div>
          {stagedFiles.length === 0 ? (
            <div className="text-xs text-gray-600 py-1">无</div>
          ) : (
            stagedFiles.map((f) => (
              <div
                key={f.path}
                className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-gray-800"
              >
                <span className="text-xs text-green-400 truncate" title={f.path}>
                  {f.path}
                </span>
                <span className="text-xs text-gray-600 ml-1 shrink-0">{f.index}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Diff 查看器 ── */}
      <div className="shrink-0 border-t border-gray-700">
        <button
          onClick={handleToggleDiff}
          className="w-full flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
        >
          {showDiff ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Eye className="w-3 h-3" />
          <span>查看 Diff</span>
        </button>
        {showDiff && (
          <div className="max-h-48 overflow-auto border-t border-gray-800 bg-gray-950">
            <DiffViewer diff={diff} />
          </div>
        )}
      </div>

      {/* ── Commit 输入区 ── */}
      <div className="shrink-0 px-3 py-2 border-t border-gray-700">
        <textarea
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          placeholder="提交消息..."
          rows={2}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
        />
        <button
          onClick={handleCommit}
          disabled={!commitMsg.trim() || stagedFiles.length === 0 || committing}
          className="mt-1.5 w-full flex items-center justify-center gap-1 py-1 rounded text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium"
        >
          <GitCommit className="w-3.5 h-3.5" />
          {committing ? "提交中..." : "提交"}
        </button>
      </div>
    </div>
  )
}
