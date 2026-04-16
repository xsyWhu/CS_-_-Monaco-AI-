/**
 * Day 6: useChat Hook（扩展版）。
 *
 * 相较 Day 5 新增三个事件订阅：
 * - onChatThinking  → handleThinking
 * - onChatIteration → handleIteration
 * 并暴露 abortChat 动作供 UI 使用。
 */

import { useEffect, useCallback } from "react"
import { useChatStore } from "../stores/chat.store"
import { useFileTreeStore } from "../stores/file-tree.store"

export function useChat() {
  const sendMessage = useChatStore((s) => s.sendMessage)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const newConversation = useChatStore((s) => s.newConversation)
  const abortChat = useChatStore((s) => s.abortChat)
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
    const unsub4 = window.api.onChatToolCall((data) => {
      useChatStore.getState().handleToolCall(data)
    })
    const unsub5 = window.api.onChatToolResult((data) => {
      useChatStore.getState().handleToolResult(data)
    })
    // Day 6 新增：订阅思考状态与迭代轮次事件。
    const unsub6 = window.api.onChatThinking(() => {
      useChatStore.getState().handleThinking()
    })
    const unsub7 = window.api.onChatIteration((data) => {
      useChatStore.getState().handleIteration(data.current, data.max)
    })

    return () => {
      unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7()
    }
  }, [])

  const send = useCallback(
    async (content: string) => {
      await sendMessage(content, workspaceRoot ?? process.cwd())
    },
    [sendMessage, workspaceRoot],
  )

  return { sendMessage: send, isStreaming, newConversation, abortChat }
}