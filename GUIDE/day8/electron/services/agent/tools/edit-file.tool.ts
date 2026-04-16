/**
 * Day 7: edit_file 工具——精准字符串替换（代码 Patch）。
 *
 * 设计思路：
 * - 不使用行号，而是用「精确文本匹配」定位要修改的位置。
 * - 要求 old_string 在文件中唯一出现：
 *   - 出现 0 次 → 报错，让模型重新确认内容。
 *   - 出现 > 1 次 → 报错，要求模型提供更多上下文以唯一定位。
 * - 这种设计避免了行号在文件被修改后失效的问题（行号漂移）。
 *
 * 安全约束：目标路径必须在工作区内（同 write_file 的防护逻辑）。
 */

import { promises as fs } from "fs"
import * as path from "path"
import type { AgentTool } from "./tool-registry"

const editFileTool: AgentTool = {
  name: "edit_file",
  description:
    "通过精确字符串匹配，将文件中的 old_string 替换为 new_string。" +
    "old_string 必须在文件中唯一出现（包含足够的上下文行）。" +
    "修改前建议先用 read_file 读取文件内容，确保 old_string 与实际内容完全一致（含缩进/空格）。",

  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "相对于工作区根目录的文件路径。",
      },
      old_string: {
        type: "string",
        description:
          "要被替换的精确文本（区分大小写，含空白字符）。" +
          "必须包含足够多的上下文行（通常 3~5 行）以保证唯一匹配。",
      },
      new_string: {
        type: "string",
        description: "替换后的新文本。可以为空字符串（相当于删除 old_string）。",
      },
    },
    required: ["path", "old_string", "new_string"],
  },

  async execute(args, context): Promise<string> {
    const relativePath = String(args.path ?? "")
    const oldString = String(args.old_string ?? "")
    const newString = String(args.new_string ?? "")

    if (!relativePath) return JSON.stringify({ error: "参数 path 不能为空。" })
    if (!oldString) return JSON.stringify({ error: "参数 old_string 不能为空。" })

    // ── 路径安全校验（防止路径穿越） ────────────────────────────────────────
    const absTarget = path.resolve(context.workspacePath, relativePath)
    const rel = path.relative(path.resolve(context.workspacePath), absTarget)
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return JSON.stringify({ error: "安全错误：不允许编辑工作区目录之外的文件。" })
    }

    // ── 读取文件 ──────────────────────────────────────────────────────────
    let content: string
    try {
      content = await fs.readFile(absTarget, "utf-8")
    } catch (e) {
      const err = e as NodeJS.ErrnoException
      if (err.code === "ENOENT") {
        return JSON.stringify({ error: `文件不存在：${rel}` })
      }
      return JSON.stringify({ error: `读取文件失败：${err.message}` })
    }

    // ── 唯一性校验 ────────────────────────────────────────────────────────
    const occurrences = content.split(oldString).length - 1

    if (occurrences === 0) {
      return JSON.stringify({
        error:
          `在 ${rel} 中未找到 old_string。` +
          "请用 read_file 重新读取文件内容，确保文本（含缩进/换行）与文件实际内容完全一致。",
      })
    }

    if (occurrences > 1) {
      return JSON.stringify({
        error:
          `old_string 在 ${rel} 中出现了 ${occurrences} 次，无法唯一定位修改位置。` +
          "请在 old_string 中包含更多上下文行（前后各 3~5 行）以确保唯一匹配。",
      })
    }

    // ── 执行替换 ──────────────────────────────────────────────────────────
    const newContent = content.replace(oldString, newString)
    await fs.writeFile(absTarget, newContent, "utf-8")

    // Day 8: 通知前端文件发生变更（供 Inline Diff 使用）。
    context.onFileChange?.({
      filePath: absTarget,
      oldContent: content,
      newContent,
      toolName: "edit_file",
    })

    // 统计变更行数供模型确认。
    const oldLines = oldString.split("\n").length
    const newLines = newString.split("\n").length
    const delta = newLines - oldLines
    const sign = delta >= 0 ? "+" : ""
    return `文件 ${rel} 修改成功。替换了 ${oldLines} 行 → ${newLines} 行（${sign}${delta} 行）。`
  },
}

export default editFileTool
