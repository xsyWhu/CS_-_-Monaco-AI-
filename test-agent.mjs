/**
 * Standalone test script for the Agent's LLM connection and tool-calling.
 *
 * Usage:
 *   node test-agent.mjs [workspacePath]
 *
 * Reads settings from %APPDATA%/my-agent-ide/agent-settings.json.
 * If no settings file exists, it tries Ollama at localhost:11434.
 */

import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import os from 'os'

const WORKSPACE = process.argv[2] || process.cwd()

// --------------- load settings ---------------
function loadSettings() {
  const candidates = [
    path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'my-agent-ide', 'agent-settings.json'),
  ]

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'))
        if (data.provider) {
          console.log(`[Settings] Loaded from ${p}`)
          return data.provider
        }
      }
    } catch { /* skip */ }
  }

  console.log('[Settings] No saved settings found, using Ollama defaults')
  return {
    apiKey: 'ollama',
    baseURL: 'http://localhost:11434/v1',
    model: 'qwen2.5-coder:7b',
  }
}

// --------------- tool definitions ---------------
const tools = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a file at the given path inside the workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative or absolute path to the file' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files and directories at the given path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' },
          recursive: { type: 'boolean', description: 'List recursively' },
        },
        required: ['path'],
      },
    },
  },
]

// --------------- tool executor ---------------
async function executeTool(name, args) {
  const stripped = (args.path || '.').replace(/^[/\\]+/, '')
  const resolved = (!stripped || stripped === '.') ? WORKSPACE
    : path.isAbsolute(stripped) ? stripped
    : path.resolve(WORKSPACE, stripped)

  if (name === 'read_file') {
    try {
      const content = fs.readFileSync(resolved, 'utf-8')
      const lines = content.split('\n')
      return lines.map((l, i) => `${String(i + 1).padStart(4)}|${l}`).join('\n')
    } catch (e) {
      return `Error: ${e.message}`
    }
  }

  if (name === 'list_files') {
    try {
      const entries = fs.readdirSync(resolved, { withFileTypes: true })
      return entries.map(e => `${e.isDirectory() ? '[DIR]' : '[FILE]'} ${e.name}`).join('\n')
    } catch (e) {
      return `Error: ${e.message}`
    }
  }

  return `Unknown tool: ${name}`
}

// --------------- text-based tool call parser (same as agent-loop) ---------------
function findMatchingBrace(text, start) {
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < text.length; i++) {
    if (esc) { esc = false; continue }
    const ch = text[i]
    if (ch === '\\' && inStr) { esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '{') depth++
    else if (ch === '}') depth--
    if (depth === 0) return i
  }
  return -1
}

function parseToolCallsFromText(text, toolNames) {
  const results = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '{') {
      const end = findMatchingBrace(text, i)
      if (end > i) {
        try {
          const obj = JSON.parse(text.substring(i, end + 1))
          if (obj.name && toolNames.has(obj.name)) {
            results.push({ name: obj.name, arguments: obj.arguments || obj.parameters || {} })
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

// --------------- main test ---------------
async function main() {
  const config = loadSettings()
  console.log(`[Test] Provider: ${config.baseURL}  Model: ${config.model}`)
  console.log(`[Test] Workspace: ${WORKSPACE}`)
  console.log()

  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL })
  const toolNames = new Set(tools.map(t => t.function.name))

  const messages = [
    { role: 'system', content: `You are a code assistant. You have tools to read files and list directories. Use them to answer questions about the workspace.\n\nWORKSPACE ROOT: ${WORKSPACE}\n\nAll file paths in tool calls MUST be relative to the workspace root. Use "." for the root itself. NEVER use absolute paths or leading slashes.` },
    { role: 'user', content: '请列出当前工作区的根目录文件，然后阅读其中一个关键文件，给出一句话总结这个项目。' },
  ]

  const MAX_ITER = 5
  for (let iter = 1; iter <= MAX_ITER; iter++) {
    console.log(`--- Iteration ${iter} ---`)

    let fullText = ''
    const apiToolCalls = []

    try {
      const stream = await client.chat.completions.create({
        model: config.model,
        messages,
        tools,
        stream: true,
      })

      const builders = new Map()

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        if (!delta) continue

        if (delta.content) {
          fullText += delta.content
          process.stdout.write(delta.content)
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) {
              builders.set(tc.index, { id: tc.id, name: tc.function?.name || '', arguments: tc.function?.arguments || '' })
            } else {
              const b = builders.get(tc.index)
              if (b && tc.function?.arguments) b.arguments += tc.function.arguments
            }
          }
        }

        if (chunk.choices[0]?.finish_reason) {
          for (const [, b] of builders) {
            apiToolCalls.push({ id: b.id, type: 'function', function: { name: b.name, arguments: b.arguments } })
          }
          builders.clear()
        }
      }

      if (fullText) console.log()
    } catch (err) {
      console.error(`\n[Error] LLM request failed: ${err.message}`)
      return
    }

    // Check for API tool calls
    if (apiToolCalls.length > 0) {
      console.log(`[Tool] ${apiToolCalls.length} API tool call(s)`)
      messages.push({ role: 'assistant', content: fullText || null, tool_calls: apiToolCalls })

      for (const tc of apiToolCalls) {
        let args = {}
        try { args = JSON.parse(tc.function.arguments) } catch {}
        console.log(`  → ${tc.function.name}(${JSON.stringify(args)})`)
        const result = await executeTool(tc.function.name, args)
        console.log(`  ← ${result.substring(0, 120)}${result.length > 120 ? '...' : ''}`)
        messages.push({ role: 'tool', content: result, tool_call_id: tc.id })
      }
      continue
    }

    // Fallback: parse tool calls from text
    const parsed = parseToolCallsFromText(fullText, toolNames)
    if (parsed.length > 0) {
      console.log(`[Tool] ${parsed.length} text-parsed tool call(s)`)
      const fakeCalls = parsed.map((tc, i) => ({
        id: `text_${Date.now()}_${i}`,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      }))
      messages.push({ role: 'assistant', content: fullText, tool_calls: fakeCalls })

      for (const tc of fakeCalls) {
        let args = {}
        try { args = JSON.parse(tc.function.arguments) } catch {}
        console.log(`  → ${tc.function.name}(${JSON.stringify(args)})`)
        const result = await executeTool(tc.function.name, args)
        console.log(`  ← ${result.substring(0, 120)}${result.length > 120 ? '...' : ''}`)
        messages.push({ role: 'tool', content: result, tool_call_id: tc.id })
      }
      continue
    }

    // No tool calls — final answer
    console.log('\n[Done] Agent provided a final answer.')
    break
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
