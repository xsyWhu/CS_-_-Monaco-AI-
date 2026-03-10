/**
 * Multi-turn conversation test for the Agent.
 * Tests: tool calling → follow-up question → continued tool use.
 */

import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import os from 'os'

const WORKSPACE = process.argv[2] || process.cwd()

function loadSettings() {
  const p = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'my-agent-ide', 'agent-settings.json')
  try {
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'))
      if (data.provider) return data.provider
    }
  } catch {}
  return { apiKey: 'ollama', baseURL: 'http://localhost:11434/v1', model: 'qwen2.5-coder:7b' }
}

const tools = [
  { type: 'function', function: { name: 'read_file', description: 'Read a file. Path is relative to workspace root.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'list_files', description: 'List files in a directory. Path is relative to workspace root.', parameters: { type: 'object', properties: { path: { type: 'string' }, recursive: { type: 'boolean' } }, required: ['path'] } } },
]

function resolvePath(p) {
  const stripped = (p || '.').replace(/^[/\\]+/, '')
  if (!stripped || stripped === '.') return WORKSPACE
  if (path.isAbsolute(stripped)) return stripped
  return path.resolve(WORKSPACE, stripped)
}

async function executeTool(name, args) {
  const resolved = resolvePath(args.path)
  if (name === 'read_file') {
    try {
      const c = fs.readFileSync(resolved, 'utf-8')
      return c.split('\n').map((l, i) => `${String(i + 1).padStart(4)}|${l}`).join('\n')
    } catch (e) { return `Error: ${e.message}` }
  }
  if (name === 'list_files') {
    try {
      return fs.readdirSync(resolved, { withFileTypes: true }).map(e => `${e.isDirectory() ? '[DIR]' : '[FILE]'} ${e.name}`).join('\n')
    } catch (e) { return `Error: ${e.message}` }
  }
  return `Unknown tool: ${name}`
}

function findMatchingBrace(text, start) {
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < text.length; i++) {
    if (esc) { esc = false; continue }
    if (text[i] === '\\' && inStr) { esc = true; continue }
    if (text[i] === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (text[i] === '{') depth++; else if (text[i] === '}') depth--
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
            i = end + 1; continue
          }
        } catch {}
      }
    }
    i++
  }
  return results
}

async function sendTurn(client, messages, turnLabel) {
  console.log(`\n====== ${turnLabel} ======`)
  const toolNames = new Set(tools.map(t => t.function.name))

  for (let iter = 1; iter <= 5; iter++) {
    console.log(`--- Iteration ${iter} ---`)
    let fullText = ''
    const apiToolCalls = []

    try {
      const stream = await client.chat.completions.create({ model: loadSettings().model, messages, tools, stream: true })
      const builders = new Map()
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        if (!delta) continue
        if (delta.content) { fullText += delta.content; process.stdout.write(delta.content) }
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) builders.set(tc.index, { id: tc.id, name: tc.function?.name || '', arguments: tc.function?.arguments || '' })
            else { const b = builders.get(tc.index); if (b && tc.function?.arguments) b.arguments += tc.function.arguments }
          }
        }
        if (chunk.choices[0]?.finish_reason) {
          for (const [, b] of builders) apiToolCalls.push({ id: b.id, type: 'function', function: { name: b.name, arguments: b.arguments } })
          builders.clear()
        }
      }
      if (fullText) console.log()
    } catch (err) {
      console.error(`[Error] ${err.message}`); return fullText
    }

    if (apiToolCalls.length > 0) {
      messages.push({ role: 'assistant', content: fullText || null, tool_calls: apiToolCalls })
      for (const tc of apiToolCalls) {
        let args = {}; try { args = JSON.parse(tc.function.arguments) } catch {}
        console.log(`  [Tool] ${tc.function.name}(${JSON.stringify(args)})`)
        const result = await executeTool(tc.function.name, args)
        console.log(`  [Result] ${result.substring(0, 80)}...`)
        messages.push({ role: 'tool', content: result, tool_call_id: tc.id })
      }
      continue
    }

    const parsed = parseToolCallsFromText(fullText, toolNames)
    if (parsed.length > 0) {
      const fakeCalls = parsed.map((tc, i) => ({ id: `t_${Date.now()}_${i}`, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.arguments) } }))
      messages.push({ role: 'assistant', content: fullText, tool_calls: fakeCalls })
      for (const tc of fakeCalls) {
        let args = {}; try { args = JSON.parse(tc.function.arguments) } catch {}
        console.log(`  [Tool-text] ${tc.function.name}(${JSON.stringify(args)})`)
        const result = await executeTool(tc.function.name, args)
        console.log(`  [Result] ${result.substring(0, 80)}...`)
        messages.push({ role: 'tool', content: result, tool_call_id: tc.id })
      }
      continue
    }

    messages.push({ role: 'assistant', content: fullText })
    return fullText
  }
  return ''
}

async function main() {
  const config = loadSettings()
  console.log(`Provider: ${config.baseURL}  Model: ${config.model}  Workspace: ${WORKSPACE}\n`)
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL })

  const messages = [
    { role: 'system', content: `You are a code assistant with tools to interact with a workspace.\n\nWORKSPACE ROOT: ${WORKSPACE}\nAll paths must be relative to workspace root. Use "." for root.` },
  ]

  // Turn 1
  messages.push({ role: 'user', content: '这个项目是做什么的？先列出文件再读取关键文件。' })
  await sendTurn(client, messages, 'Turn 1: Project overview')

  // Turn 2 (follow-up, should use context from turn 1)
  messages.push({ role: 'user', content: '现在请阅读 src 目录下的主要源文件，告诉我这个程序的入口函数做了什么。' })
  await sendTurn(client, messages, 'Turn 2: Follow-up - read source')

  console.log('\n\n===== TEST COMPLETE =====')
  console.log(`Total messages in conversation: ${messages.length}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
