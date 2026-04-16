/**
 * Day 7: run_command 工具——在工作区静默执行 Shell 命令。
 *
 * 安全设计：
 * 1. 执行目录（cwd）强制限定在工作区内，防止路径穿越。
 * 2. 超时保护（30 秒）：避免命令挂起阻塞 Agent Loop。
 * 3. 输出截断（10 000 字符）：防止超长输出耗尽上下文窗口。
 * 4. stdout + stderr 合并返回：让模型能同时看到正常输出和错误信息。
 *
 * 注意：此工具具有「高危」属性——可以执行任意系统命令。
 * 在生产环境应添加命令白名单或沙箱隔离；本教程仅做能力演示。
 */

import { execSync } from "child_process"
import * as path from "path"
import type { AgentTool } from "./tool-registry"

/** 命令执行超时（毫秒）。 */
const TIMEOUT_MS = 30_000
/** 返回给模型的最大输出字符数（防止撑爆上下文）。 */
const MAX_OUTPUT = 10_000

/** 如果输出超长，截取头尾各一半并插入省略提示。 */
function truncate(output: string): string {
  if (output.length <= MAX_OUTPUT) return output
  const half = Math.floor(MAX_OUTPUT / 2)
  return (
    output.slice(0, half) +
    `\n\n--- 输出已截断（原始长度 ${output.length} 字符）---\n\n` +
    output.slice(-half)
  )
}

const runCommandTool: AgentTool = {
  name: "run_command",
  description:
    "在工作区目录（或指定子目录）中执行 Shell 命令，返回 stdout / stderr 合并输出。" +
    "适用于：运行测试、执行构建、安装依赖、查看 Git 状态等。" +
    "命令超时上限为 30 秒。",

  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "要执行的 Shell 命令，例如 'npm test' 或 'git status'。",
      },
      cwd: {
        type: "string",
        description:
          "可选。命令执行目录（相对于工作区根目录）。默认为工作区根目录。",
      },
    },
    required: ["command"],
  },

  async execute(args, context): Promise<string> {
    const command = String(args.command ?? "").trim()
    if (!command) return JSON.stringify({ error: "参数 command 不能为空。" })

    // ── cwd 路径安全校验 ──────────────────────────────────────────────────
    let cwd: string
    if (args.cwd) {
      const absTarget = path.resolve(context.workspacePath, String(args.cwd))
      const rel = path.relative(path.resolve(context.workspacePath), absTarget)
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        return JSON.stringify({ error: "安全错误：不允许在工作区目录之外执行命令。" })
      }
      cwd = absTarget
    } else {
      cwd = context.workspacePath
    }

    // ── 执行命令 ──────────────────────────────────────────────────────────
    try {
      const output = execSync(command, {
        cwd,
        timeout: TIMEOUT_MS,
        encoding: "utf-8",
        // Windows 用 PowerShell，其他平台用 sh。
        shell: process.platform === "win32" ? "powershell.exe" : "/bin/sh",
        // 合并 stderr 到 stdout（让模型能看到错误信息）。
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 10 * 1024 * 1024,
      })
      return truncate(output?.trim() ?? "(命令执行完毕，无输出)")
    } catch (error) {
      const err = error as {
        killed?: boolean
        signal?: string
        status?: number
        stdout?: string
        stderr?: string
        message?: string
      }

      // 超时
      if (err.killed || err.signal === "SIGTERM") {
        return `命令执行超时（超过 ${TIMEOUT_MS / 1000} 秒）。请考虑使用更快速的命令或减小工作量。`
      }

      // 非零退出码（命令本身报错，如 npm test 失败）
      const parts: string[] = []
      if (err.stdout?.trim()) parts.push(err.stdout.trim())
      if (err.stderr?.trim()) parts.push(err.stderr.trim())
      const output = parts.length > 0 ? parts.join("\n") : (err.message ?? "未知错误")
      const exitInfo = err.status != null ? `\n(退出码: ${err.status})` : ""
      return truncate(output + exitInfo)
    }
  },
}

export default runCommandTool
