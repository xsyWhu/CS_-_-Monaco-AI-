import Editor from '@monaco-editor/react'

const INITIAL_CODE = `function greet(name: string): string {
  return \`Hello, ${name}!\`
}

console.log(greet('Day2'))
`

export default function MonacoWrapper() {
  return (
    <Editor
      height="100%"
      defaultLanguage="typescript"
      defaultValue={INITIAL_CODE}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        automaticLayout: true,
        wordWrap: 'on',
        scrollBeyondLastLine: false
      }}
    />
  )
}
