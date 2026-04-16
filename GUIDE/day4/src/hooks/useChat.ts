/**
 * Day 4: 封装 Chat 事件监听的自定义 Hook。
 *
 * 在组件挂载时注册 onChatStream / onChatComplete / onChatError，
 * 卸载时自动解注册，保证事件不泄漏。
 */

import { useEffect, useCallback } from 'react'
import { useChatStore } from '../stores/chat.store'

export function useChat() {
  const sendMessage = useChatStore((s) => s.sendMessage)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const newConversation = useChatStore((s) => s.newConversation)

  useEffect(() => {
    // 从 store 获取最新引用（避免闭包过期）。
    const unsub1 = window.api.onChatStream((data) => {
      useChatStore.getState().appendToken(data.token)
    })

    const unsub2 = window.api.onChatComplete((data) => {
      useChatStore.getState().handleComplete(data.message)
    })

    const unsub3 = window.api.onChatError((data) => {
      useChatStore.getState().handleError(data.error)
    })

    return () => {
      unsub1()
      unsub2()
      unsub3()
    }
  }, [])

  const send = useCallback(
    async (content: string) => {
      await sendMessage(content)
    },
    [sendMessage]
  )

  return { sendMessage: send, isStreaming, newConversation }
}
