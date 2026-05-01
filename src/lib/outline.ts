import * as ts from 'typescript'
import type { OutlineItem } from '@/types/editor.types'

function createItem(
  name: string,
  kind: string,
  line: number,
  column: number,
  depth: number,
): OutlineItem {
  return {
    id: `${kind}:${name}:${line}:${column}:${depth}`,
    name,
    kind,
    line,
    column,
    depth,
    children: [],
  }
}

function getPosition(sourceFile: ts.SourceFile, node: ts.Node): { line: number; column: number } {
  const start = node.getStart(sourceFile)
  const pos = sourceFile.getLineAndCharacterOfPosition(start)
  return { line: pos.line + 1, column: pos.character + 1 }
}

function getNameText(
  sourceFile: ts.SourceFile,
  node: ts.Node & { name?: ts.Node | undefined },
  fallback: string,
): string {
  if (node.name && ts.isIdentifier(node.name)) {
    return node.name.text
  }

  if (node.name) {
    return node.name.getText(sourceFile)
  }

  return fallback
}

function collectClassMembers(
  sourceFile: ts.SourceFile,
  members: ts.ClassElement[],
  depth: number,
): OutlineItem[] {
  const items: OutlineItem[] = []

  for (const member of members) {
    if (
      ts.isConstructorDeclaration(member) ||
      ts.isMethodDeclaration(member) ||
      ts.isGetAccessorDeclaration(member) ||
      ts.isSetAccessorDeclaration(member) ||
      ts.isPropertyDeclaration(member)
    ) {
      const name = getNameText(sourceFile, member, 'anonymous')
      const { line, column } = getPosition(sourceFile, member)
      const kind = ts.isConstructorDeclaration(member)
        ? 'constructor'
        : ts.isMethodDeclaration(member)
          ? 'method'
          : ts.isPropertyDeclaration(member)
            ? 'property'
            : 'accessor'

      items.push(createItem(name, kind, line, column, depth))
    }
  }

  return items
}

function collectInterfaceMembers(
  sourceFile: ts.SourceFile,
  members: ts.TypeElement[],
  depth: number,
): OutlineItem[] {
  const items: OutlineItem[] = []

  for (const member of members) {
    if (ts.isPropertySignature(member) || ts.isMethodSignature(member)) {
      const name = getNameText(sourceFile, member, 'member')
      const { line, column } = getPosition(sourceFile, member)
      const kind = ts.isMethodSignature(member) ? 'method' : 'property'
      items.push(createItem(name, kind, line, column, depth))
    }
  }

  return items
}

function collectStatementNodes(
  sourceFile: ts.SourceFile,
  statements: readonly ts.Statement[],
  depth: number,
): OutlineItem[] {
  const items: OutlineItem[] = []

  for (const statement of statements) {
    if (ts.isFunctionDeclaration(statement)) {
      const name = statement.name?.text ?? (statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ? 'default function' : 'function')
      const { line, column } = getPosition(sourceFile, statement)
      items.push(createItem(name, 'function', line, column, depth))
      continue
    }

    if (ts.isClassDeclaration(statement)) {
      const name = statement.name?.text ?? 'default class'
      const { line, column } = getPosition(sourceFile, statement)
      const item = createItem(name, 'class', line, column, depth)
      item.children = collectClassMembers(sourceFile, statement.members, depth + 1)
      items.push(item)
      continue
    }

    if (ts.isInterfaceDeclaration(statement)) {
      const { line, column } = getPosition(sourceFile, statement)
      const item = createItem(statement.name.text, 'interface', line, column, depth)
      item.children = collectInterfaceMembers(sourceFile, statement.members, depth + 1)
      items.push(item)
      continue
    }

    if (ts.isEnumDeclaration(statement)) {
      const { line, column } = getPosition(sourceFile, statement)
      const item = createItem(statement.name.text, 'enum', line, column, depth)
      item.children = statement.members.map((member) => {
        const { line: memberLine, column: memberColumn } = getPosition(sourceFile, member)
        return createItem(member.name.getText(sourceFile), 'enum member', memberLine, memberColumn, depth + 1)
      })
      items.push(item)
      continue
    }

    if (ts.isTypeAliasDeclaration(statement)) {
      const { line, column } = getPosition(sourceFile, statement)
      items.push(createItem(statement.name.text, 'type', line, column, depth))
      continue
    }

    if (ts.isModuleDeclaration(statement)) {
      const { line, column } = getPosition(sourceFile, statement)
      const name = statement.name.getText(sourceFile)
      const item = createItem(name, 'namespace', line, column, depth)
      if (statement.body && ts.isModuleBlock(statement.body)) {
        item.children = collectStatementNodes(sourceFile, statement.body.statements, depth + 1)
      }
      items.push(item)
      continue
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const name = declaration.name.getText(sourceFile)
        const { line, column } = getPosition(sourceFile, declaration)
        const item = createItem(name, 'variable', line, column, depth)

        if (declaration.initializer) {
          if (
            ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer) ||
            ts.isClassExpression(declaration.initializer)
          ) {
            const childKind = ts.isClassExpression(declaration.initializer)
              ? 'class'
              : 'function'
            const childName =
              ts.isClassExpression(declaration.initializer) && declaration.initializer.name
                ? declaration.initializer.name.text
                : name
            const childPosition = getPosition(sourceFile, declaration.initializer)
            const child = createItem(
              childName,
              childKind,
              childPosition.line,
              childPosition.column,
              depth + 1,
            )
            if (ts.isClassExpression(declaration.initializer)) {
              child.children = collectClassMembers(
                sourceFile,
                declaration.initializer.members,
                depth + 2,
              )
            }
            item.children = [child]
          }
        }

        items.push(item)
      }
    }
  }

  return items
}

function extractMarkdownOutline(content: string): OutlineItem[] {
  const lines = content.split(/\r?\n/)
  const root: OutlineItem[] = []
  const stack: Array<{ level: number; children: OutlineItem[] }> = [{ level: 0, children: root }]

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.*)$/)
    if (!match) return

    const level = match[1].length
    const title = match[2].trim()
    const item = createItem(title, 'heading', index + 1, 1, level - 1)

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }

    const parent = stack[stack.length - 1]
    parent.children.push(item)
    stack.push({ level, children: item.children ?? [] })
  })

  return root
}

export function extractOutlineItems(
  fileName: string,
  language: string,
  content: string,
): OutlineItem[] {
  if (!content.trim()) return []

  if (language === 'markdown' || fileName.toLowerCase().endsWith('.md')) {
    return extractMarkdownOutline(content)
  }

  const normalizedLanguage = language.toLowerCase()
  const supportsAst =
    normalizedLanguage === 'typescript' ||
    normalizedLanguage === 'typescriptreact' ||
    normalizedLanguage === 'javascript' ||
    normalizedLanguage === 'javascriptreact'

  if (!supportsAst) return []

  const scriptKind =
    normalizedLanguage === 'typescript'
      ? ts.ScriptKind.TS
      : normalizedLanguage === 'typescriptreact'
        ? ts.ScriptKind.TSX
        : normalizedLanguage === 'javascriptreact'
          ? ts.ScriptKind.JSX
          : ts.ScriptKind.JS

  const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, scriptKind)
  return collectStatementNodes(sourceFile, sourceFile.statements, 0)
}
