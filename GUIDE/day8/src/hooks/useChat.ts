/**
 * Day 8: useChat Hook（扩展版）。
 *
 * 相较 Day 7 新增：
 * - onChatFileChange 事件订阅 → 将文件变更加入 editor store 的 pendingDiffs。
 */

import { useEffect, useCallback } from "react"
import { useChatStore } from "../stores/chat.store"
import { useFileTreeStore } from "../stores/file-tree.store"
import { useEditorStore } from "../stores/editor.store"

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
    const unsub6 = window.api.onChatThinking(() => {
      useChatStore.getState().handleThinking()
    })
    const unsub7 = window.api.onChatIteration((data) => {
      useChatStore.getState().handleIteration(data.current, data.max)
    })

    // Day 8: 订阅文件变更事件，将变更加入待审核队列并自动打开审核视图。
    const unsub8 = window.api.onChatFileChange((data) => {
      const store = useEditorStore.getState()
      store.addPendingDiff(data)
      // 自动打开该文件的 diff 审核视图。
      store.reviewDiff(data.filePath)
    })

    return () => {
      unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); unsub8()
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