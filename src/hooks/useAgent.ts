import { useEffect, useCallback, useRef } from 'react'
import { useChatStore } from '@/stores/chat.store'

export function useAgent() {
  const sendMessage = useChatStore((state) => state.sendMessage)
  const cancelStream = useChatStore((state) => state.cancelStream)
  const isStreaming = useChatStore((state) => state.isStreaming)

  const storeRef = useRef(useChatStore.getState())
  const activeConversationIdRef = useRef<string | null>(null)

  useEffect(() => {
    return useChatStore.subscribe((state) => {
      storeRef.current = state
    })
  }, [])

  useEffect(() => {
    const unsubStream = window.api.onAgentStream((data) => {
      // Use the active conversation ID we're tracking, or fall back to store
      const targetId = activeConversationIdRef.current || storeRef.current.conversationId
      if (targetId && data.conversationId === targetId) {
        storeRef.current.appendStreamToken(data.token)
      }
    })

    const unsubTextReplace = window.api.onAgentTextReplace((data) => {
      const targetId = activeConversationIdRef.current || storeRef.current.conversationId
      if (targetId && data.conversationId === targetId) {
        storeRef.current.replaceStreamText(data.text)
      }
    })

    const unsubToolCall = window.api.onAgentToolCall((data) => {
      const targetId = activeConversationIdRef.current || storeRef.current.conversationId
      if (targetId && data.conversationId === targetId) {
        storeRef.current.handleToolCall(data.toolCall as any)
      }
    })

    const unsubComplete = window.api.onAgentComplete((data) => {
      const targetId = activeConversationIdRef.current || storeRef.current.conversationId
      if (targetId && data.conversationId === targetId) {
        storeRef.current.handleComplete(data.message as string)
        // Reset active conversation ID after completion
        activeConversationIdRef.current = null
      }
    })

    const unsubError = window.api.onAgentError((data) => {
      const targetId = activeConversationIdRef.current || storeRef.current.conversationId
      if (targetId && data.conversationId === targetId) {
        storeRef.current.handleError(data.error)
        // Reset active conversation ID after error
        activeConversationIdRef.current = null
      }
    })

    return () => {
      unsubStream()
      unsubTextReplace()
      unsubToolCall()
      unsubComplete()
      unsubError()
    }
  }, [])

  const send = useCallback(
    async (content: string) => {
      // Send message and wait for conversationId to be returned
      const convId = await sendMessage(content)
      // Immediately track the active conversation ID before any stream data arrives
      activeConversationIdRef.current = convId
      return convId
    },
    [sendMessage],
  )

  const cancel = useCallback(async () => {
    await cancelStream()
    activeConversationIdRef.current = null
  }, [cancelStream])

  return {
    sendMessage: send,
    cancelStream: cancel,
    isStreaming,
  }
}
