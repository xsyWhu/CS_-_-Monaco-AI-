import { useEffect, useCallback, useRef } from 'react'
import { useChatStore } from '@/stores/chat.store'

export function useAgent() {
  const sendMessage = useChatStore((state) => state.sendMessage)
  const cancelStream = useChatStore((state) => state.cancelStream)
  const isStreaming = useChatStore((state) => state.isStreaming)

  const storeRef = useRef(useChatStore.getState())

  useEffect(() => {
    return useChatStore.subscribe((state) => {
      storeRef.current = state
    })
  }, [])

  useEffect(() => {
    const unsubStream = window.api.onAgentStream((data) => {
      const cid = storeRef.current.conversationId
      if (!cid || data.conversationId === cid) {
        storeRef.current.appendStreamToken(data.token)
      }
    })

    const unsubTextReplace = window.api.onAgentTextReplace((data) => {
      const cid = storeRef.current.conversationId
      if (!cid || data.conversationId === cid) {
        storeRef.current.replaceStreamText(data.text)
      }
    })

    const unsubToolCall = window.api.onAgentToolCall((data) => {
      const cid = storeRef.current.conversationId
      if (!cid || data.conversationId === cid) {
        storeRef.current.handleToolCall(data.toolCall as any)
      }
    })

    const unsubComplete = window.api.onAgentComplete((data) => {
      const cid = storeRef.current.conversationId
      if (!cid || data.conversationId === cid) {
        storeRef.current.handleComplete(data.message as string)
      }
    })

    const unsubError = window.api.onAgentError((data) => {
      const cid = storeRef.current.conversationId
      if (!cid || data.conversationId === cid) {
        storeRef.current.handleError(data.error)
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
      await sendMessage(content)
    },
    [sendMessage],
  )

  const cancel = useCallback(async () => {
    await cancelStream()
  }, [cancelStream])

  return {
    sendMessage: send,
    cancelStream: cancel,
    isStreaming,
  }
}
