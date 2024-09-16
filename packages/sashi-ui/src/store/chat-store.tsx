import {create} from "zustand"
import {createJSONStorage, persist} from "zustand/middleware"
import {MessageItem, Metadata} from "./models"
export const APP_STORAGE_KEY = "openai-api-function-call-sample-storage"

interface MessageState {
    messages: MessageItem[]
    metadata: Metadata
    addMessage: (newmessage: MessageItem) => void
    setMetadata: (metadata: Metadata) => void
    clearMessages: () => void
}

const useAppStore = create<MessageState>()(
    persist(
        (set, get) => ({
            messages: [],
            metadata: {
                name: "",
                description: "",
                functions: []
            },
            setMetadata: (metadata: Metadata) => set({metadata}),
            addMessage: (newmessage: MessageItem) => {
                let messages = get().messages.slice(0)
                messages.push(newmessage)

                set({
                    messages: messages
                })
            },
            clearMessages: () => set({messages: []})
        }),
        {
            name: APP_STORAGE_KEY,
            storage: createJSONStorage(() => localStorage),
            version: 1
        }
    )
)

export default useAppStore
