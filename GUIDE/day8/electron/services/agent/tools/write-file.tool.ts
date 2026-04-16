/**
 * Day 6: write_file 工具——向工作区文件写入内容（覆盖写）。
 *
 * 安全约束：目标路径必须在工作区根目录内，防止路径穿越攻击（Path Traversal）。
 * 父目录若不存在会自动创建（recursive mkdir）。
 */

import { promises as fs } from "fs"
import * as path from "path"
import type { AgentTool } from "./tool-registry"

const writeFileTool: AgentTool = {
  name: "write_file",
  description:
    "将指定内容写入工作区内的文件（覆盖写）。" +
    "文件不存在时自动创建，父目录也会自动创建。" +
    "修改已有文件前，请先用 read_file 读取原内容，避免意外覆盖。",

  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "相对于工作区根目录的文件路径，例如 'src/utils/helpers.ts'。",
      },
      content: {
        type: "string",
        description: "要写入文件的完整文本内容。",
      },
    },
    required: ["path", "content"],
  },

  async execute(args, context): Promise<string> {
    const relativePath = String(args.path ?? "")
    const content = String(args.content ?? "")

    if (!relativePath) {
      return JSON.stringify({ error: "参数 path 不能为空。" })
    }

    // ── 安全校验：防止路径穿越（Path Traversal）────────────────────────────
    // 将用户提供的相对路径解析为绝对路径后，
    // 验证它必须以工作区根目录开头。
    const absTarget = path.resolve(context.workspacePath, relativePath)
    const absWorkspace = path.resolve(context.workspacePath)

    // path.relative() 返回的相对路径若以 ".." 开头，说明目标在工作区之外。
    const rel = path.relative(absWorkspace, absTarget)
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return JSON.stringify({
        error: `安全错误：不允许写入工作区目录（${absWorkspace}）之外的文件。`,
      })
    }

    // ── 创建父目录（若不存在）────────────────────────────────────────────
    await fs.mkdir(path.dirname(absTarget), { recursive: true })

    // Day 8: 记录旧内容（用于 Inline Diff）。
    let oldContent = ""
    try {
      oldContent = await fs.readFile(absTarget, "utf-8")
    } catch {
      // 文件不存在时 oldContent 保持空字符串（新建文件场景）。
    }

    // ── 写入文件 ─────────────────────────────────────────────────────────
    await fs.writeFile(absTarget, content, "utf-8")

    // Day 8: 通知前端文件发生变更。
    context.onFileChange?.({
      filePath: absTarget,
      oldContent,
      newContent: content,
      toolName: "write_file",
    })

    return `文件已成功写入：${rel}（${content.length} 字符）`
  },
}

export default writeFileTool
