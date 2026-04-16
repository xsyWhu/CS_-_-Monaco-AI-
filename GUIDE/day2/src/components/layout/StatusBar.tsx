export default function StatusBar() {
  return (
    // Day 2 状态栏用于展示当前阶段和接入能力。
    <div className="h-6 bg-blue-600 text-white text-xs flex items-center px-4 shrink-0 transition-colors">
      <span className="font-semibold">Day 2 Monaco + Xterm</span>
      <span className="mx-4 opacity-50">|</span>
      <span>Editor & Terminal Integrated</span>
    </div>
  )
}
