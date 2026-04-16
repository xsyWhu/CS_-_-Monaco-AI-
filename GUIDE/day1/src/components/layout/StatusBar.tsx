export default function StatusBar() {
  return (
    // Day 1 状态栏仅用于展示版本与阶段信息。
    <div className="h-6 bg-blue-600 text-white text-xs flex items-center px-4 shrink-0 transition-colors">
      <span className="font-semibold">Day 1 Framework</span>
      <span className="mx-4 opacity-50">|</span>
      <span>React 19 + Electron 35 Base</span>
    </div>
  )
}
