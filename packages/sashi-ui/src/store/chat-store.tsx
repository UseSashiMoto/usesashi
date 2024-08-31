import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { MessageItem } from './models';
export const APP_STORAGE_KEY = "openai-api-function-call-sample-storage"


interface MessageState {
    messages: MessageItem[]
    threadId: string
    runId: string
    mode: number
    addMessage: (newmessage: MessageItem) => void
    clearMessages: () => void
    setThreadId: (id: any) => void
    setRunId: (id: any) => void
    setMode: (n: any) => void
}

const useAppStore = create<MessageState>()(
    persist(
        (set, get) => ({
            messages: [],
            threadId: "",
            runId: "",
            mode: 0,

            addMessage: (newmessage: MessageItem) => {
                let messages = get().messages.slice(0)
                messages.push(newmessage)

                set({
                    messages: messages
                })
            },
            clearMessages: () => set({messages: []}),
            setThreadId: (id: any) => set({threadId: id}),
            setRunId: (id: any) => set({runId: id}),
            setMode: (n: any) => set({mode: n})
        }),
        {
            name: APP_STORAGE_KEY,
            storage: createJSONStorage(() => localStorage),
            version: 1
        }
    )
)

export default useAppStore
