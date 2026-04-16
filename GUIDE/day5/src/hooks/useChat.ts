/**
 * Day 5: useChat Hook（扩展版）。
 *
 * 相较 Day 4，新增两个事件监听：
 * - onChatToolCall → handleToolCall
 * - onChatToolResult → handleToolResult
 */

import { useEffect, useCallback } from "react"
import { useChatStore } from "../stores/chat.store"
import { useFileTreeStore } from "../stores/file-tree.store"

export function useChat() {
  const sendMessage = useChatStore((s) => s.sendMessage)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const newConversation = useChatStore((s) => s.newConversation)
  // Day 5: 从 file-tree store 获取工作区路径，透传给主进程工具。
  const workspaceRoot = useFileTreeStore((s) => s.workspaceRoot)

  useEffect(() => {
    const unsub1 = window.api.onChatStream((data) => {
      useChatStore.getState().appendToken(data.token)
    })
    const unsub2 = window.api.onChatComplete((data) => {
      useChatStore.getState().handleComplete(data.message)
    })
    const unsub3 = window.api.onChatError((data) => {
      useChatStore.getState().handleError(data.error)
    })
    // Day 5 新增：工具调用生命周期事件。
    const unsub4 = window.api.onChatToolCall((data) => {
      useChatStore.getState().handleToolCall(data)
    })
    const unsub5 = window.api.onChatToolResult((data) => {
      useChatStore.getState().handleToolResult(data)
    })

    return () => {
      unsub1(); unsub2(); unsub3(); unsub4(); unsub5()
    }
  }, [])

  const send = useCallback(
    async (content: string) => {
      // 传入工作区路径，让主进程工具能正确解析文件路径。
      await sendMessage(content, workspaceRoot ?? process.cwd())
    },
    [sendMessage, workspaceRoot],
  )

  return { sendMessage: send, isStreaming, newConversation }
}