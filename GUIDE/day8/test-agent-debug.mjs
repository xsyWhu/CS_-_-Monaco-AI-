/**
 * Agent Loop 诊断测试脚本。
 *
 * 模拟完整的 Agent 循环：LLM 调用 → 工具执行 → 多轮迭代。
 * 详细日志帮助定位 Ollama 兼容性问题。
 *
 * 用法：
 *   node test-agent-debug.mjs [workspacePath]
 *
 * 默认连接本地 Ollama (http://localhost:11434/v1)。
 */

import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import os from 'os'

// ─────────────── 配置 ───────────────

const WORKSPACE = path.resolve(process.argv[2] || '.')
const MAX_ITERATIONS = 5

const CONFIG = {
  apiKey: 'ollama',
  baseURL: 'http://localhost:11434/v1',
  model: 'qwen2.5-coder:32b-instruct-q4_K_M',
}

const TEST_MESSAGE = '请告诉我：当前目录下有什么文件？请使用 list_files 工具查看。'

// ─────────────── 工具定义（与项目一致） ───────────────

const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: '列出目录结构，了解项目全貌。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对于工作区根目录的路径' },
          recursive: { type: 'boolean', description: '是否递归列出子目录' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: '读取文件内容（带行号）。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对于工作区根目录的文件路径' },
        },
        required: ['path'],
      },
    },
  },
]

const TOOL_NAMES = new Set(TOOL_DEFS.map(t => t.function.name))

// ─────────────── 工具执行 ───────────────

function resolvePath(p) {
  const stripped = (p || '.').replace(/^[/\\]+/, '')
  if (!stripped || stripped === '.') return WORKSPACE
  if (path.isAbsolute(stripped)) return stripped
  return path.resolve(WORKSPACE, stripped)
}

const IGNORED = new Set(['node_modules', '.git', 'dist', 'out', '.cache'])

function listDir(dirPath, recursive = false, depth = 0, maxDepth = 3) {
  const lines = []
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const e of entries) {
      if (e.isDirectory() && IGNORED.has(e.name)) continue
      const prefix = '  '.repeat(depth)
      lines.push(`${prefix}${e.isDirectory() ? '[DIR]' : '[FILE]'} ${e.name}`)
      if (e.isDirectory() && recursive && depth < maxDepth) {
        lines.push(...listDir(path.join(dirPath, e.name), true, depth + 1, maxDepth))
      }
    }
  } catch (err) {
    lines.push(`Error: ${err.message}`)
  }
  return lines
}

async function executeTool(name, args) {
  const resolved = resolvePath(args.path)
  if (name === 'list_files') {
    return listDir(resolved, args.recursive ?? false).join('\n') || '(空目录)'
  }
  if (name === 'read_file') {
    try {
      const content = fs.readFileSync(resolved, 'utf-8')
      return content.split('\n').map((l, i) => `${String(i + 1).padStart(4)}| ${l}`).join('\n')
    } catch (err) {
      return `Error: ${err.message}`
    }
  }
  return `Unknown tool: ${name}`
}

// ─────────────── 文本工具调用解析（回退机制） ───────────────

function findMatchingBrace(text, start) {
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < text.length; i++) {
    if (esc) { esc = false; continue }
    if (text[i] === '\\' && inStr) { esc = true; continue }
    if (text[i] === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (text[i] === '{') depth++
    else if (text[i] === '}') depth--
    if (depth === 0) return i
  }
  return -1
}

function parseToolCallsFromText(text) {
  const results = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '{') {
      const end = findMatchingBrace(text, i)
      if (end > i) {
        try {
          const obj = JSON.parse(text.substring(i, end + 1))
          if (obj.name && TOOL_NAMES.has(obj.name)) {
            results.push({
              name: obj.name,
              arguments: obj.arguments || obj.parameters || {},
            })
            i = end + 1
            continue
          }
        } catch { /* not valid JSON */ }
      }
    }
    i++
  }
  return results
}

// ─────────────── 系统提示词 ───────────────

function buildSystemPrompt() {
  return `你是一个集成在代码编辑器中的 AI 编程助手，能够直接访问用户的工作区文件系统。

当前工作区根目录：${WORKSPACE}

== 工具使用规则 ==
- 所有文件路径均相对于上方工作区根目录。
- 使用 "." 代表工作区根目录本身。

== 可用工具 ==
- list_files：列出目录结构。
- read_file：读取文件内容（带行号）。

== 行为准则 ==
1. 需要了解目录结构时，使用 list_files 工具。
2. 需要查看文件内容时，使用 read_file 工具。
3. 用自然语言解释你的每一步操作。`
}

// ─────────────── Agent 主循环 ───────────────

async function runAgentLoop() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║              Agent Loop 诊断测试                            ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log(`  Provider:  ${CONFIG.baseURL}`)
  console.log(`  Model:     ${CONFIG.model}`)
  console.log(`  Workspace: ${WORKSPACE}`)
  console.log(`  Message:   ${TEST_MESSAGE}`)
  console.log()

  const client = new OpenAI({ apiKey: CONFIG.apiKey, baseURL: CONFIG.baseURL })

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: TEST_MESSAGE },
  ]

  let fullText = ''

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`  迭代 ${iteration}/${MAX_ITERATIONS}`)
    console.log(`${'─'.repeat(60)}`)

    // ── 诊断：打印请求信息 ──
    console.log(`\n  [请求] messages 数量: ${messages.length}`)
    console.log(`  [请求] 最后一条消息: role=${messages[messages.length - 1].role}`)

    let currentText = ''
    const apiToolCalls = []
    const activeBuilders = new Map()

    // ── 统计 ──
    let chunkCount = 0
    let textChunks = 0
    let toolCallChunks = 0
    let finishReasonSeen = null

    try {
      const stream = await client.chat.completions.create({
        model: CONFIG.model,
        messages,
        tools: TOOL_DEFS,
        stream: true,
      })

      for await (const chunk of stream) {
        chunkCount++
        const delta = chunk.choices[0]?.delta
        const finishReason = chunk.choices[0]?.finish_reason

        if (!delta && !finishReason) continue

        // ── 文本增量 ──
        if (delta?.content) {
          textChunks++
          currentText += delta.content
          fullText += delta.content
          process.stdout.write(delta.content)
        }

        // ── 工具调用增量 ──
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            toolCallChunks++
            const idx = tc.index ?? 0

            if (tc.id) {
              // 新工具调用（标准 OpenAI 行为）
              console.log(`\n  [tool_call_start] index=${idx} id=${tc.id} name=${tc.function?.name}`)
              activeBuilders.set(idx, {
                id: tc.id,
                name: tc.function?.name || '',
                arguments: tc.function?.arguments || '',
              })
            } else if (!activeBuilders.has(idx) && tc.function?.name) {
              // 新工具调用但缺少 id（Ollama 兼容）
              const fakeId = `call_${Date.now()}_${idx}`
              console.log(`\n  [tool_call_start] (无id，生成假id) index=${idx} id=${fakeId} name=${tc.function.name}`)
              activeBuilders.set(idx, {
                id: fakeId,
                name: tc.function.name,
                arguments: tc.function?.arguments || '',
              })
            } else {
              // 后续 chunk：累加参数
              const existing = activeBuilders.get(idx)
              if (existing) {
                if (tc.function?.name) existing.name += tc.function.name
                if (tc.function?.arguments) existing.arguments += tc.function.arguments
              }
            }
          }
        }

        // ── 结束信号 ──
        if (finishReason) {
          finishReasonSeen = finishReason
          for (const [, b] of activeBuilders) {
            apiToolCalls.push({
              id: b.id,
              type: 'function',
              function: { name: b.name, arguments: b.arguments },
            })
          }
          activeBuilders.clear()
        }
      }

      // ── Ollama 安全网：流结束后仍有未完成的 builders ──
      if (activeBuilders.size > 0) {
        console.log(`\n  [安全网] 流结束但仍有 ${activeBuilders.size} 个未完成的工具调用（finish_reason 缺失）`)
        for (const [, b] of activeBuilders) {
          apiToolCalls.push({
            id: b.id,
            type: 'function',
            function: { name: b.name, arguments: b.arguments },
          })
        }
        activeBuilders.clear()
      }

      if (currentText) console.log() // 换行

    } catch (err) {
      console.error(`\n  [错误] API 调用失败: ${err.message}`)
      return
    }

    // ── 诊断：打印流统计 ──
    console.log(`\n  [流统计] 总 chunks: ${chunkCount}, 文本: ${textChunks}, 工具调用: ${toolCallChunks}`)
    console.log(`  [流统计] finish_reason: ${finishReasonSeen || '(无)'}`)
    console.log(`  [流统计] API 工具调用数: ${apiToolCalls.length}`)

    // ── 处理 API 层工具调用 ──
    if (apiToolCalls.length > 0) {
      console.log('\n  ✅ 检测到 API 层工具调用（Function Calling 正常工作）')
      messages.push({ role: 'assistant', content: currentText || null, tool_calls: apiToolCalls })

      for (const tc of apiToolCalls) {
        let args = {}
        try { args = JSON.parse(tc.function.arguments) } catch {}
        console.log(`\n  [执行工具] ${tc.function.name}(${JSON.stringify(args)})`)
        const result = await executeTool(tc.function.name, args)
        const preview = result.length > 200 ? result.substring(0, 200) + '...' : result
        console.log(`  [工具结果] ${preview}`)
        messages.push({ role: 'tool', content: result, tool_call_id: tc.id })
      }
      continue // 继续循环
    }

    // ── 文本回退解析 ──
    const textParsed = parseToolCallsFromText(currentText)
    if (textParsed.length > 0) {
      console.log(`\n  ⚠️  API 未检测到工具调用，但从文本中解析到 ${textParsed.length} 个（回退模式）`)
      const fakeCalls = textParsed.map((tc, i) => ({
        id: `text_call_${Date.now()}_${i}`,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      }))
      messages.push({ role: 'assistant', content: currentText, tool_calls: fakeCalls })

      for (const tc of fakeCalls) {
        let args = {}
        try { args = JSON.parse(tc.function.arguments) } catch {}
        console.log(`\n  [执行工具-文本回退] ${tc.function.name}(${JSON.stringify(args)})`)
        const result = await executeTool(tc.function.name, args)
        const preview = result.length > 200 ? result.substring(0, 200) + '...' : result
        console.log(`  [工具结果] ${preview}`)
        messages.push({ role: 'tool', content: result, tool_call_id: tc.id })
      }
      continue // 继续循环
    }

    // ── 纯文本响应：对话自然结束 ──
    console.log('\n  ℹ️  纯文本响应（无工具调用），循环结束。')
    messages.push({ role: 'assistant', content: currentText })
    break
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('  测试完成')
  console.log(`  总消息数: ${messages.length}`)
  console.log(`  累计文本长度: ${fullText.length}`)
  console.log(`${'═'.repeat(60)}`)
}

runAgentLoop().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
