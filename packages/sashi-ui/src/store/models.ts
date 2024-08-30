export type MessageItem = {
    id: string
    created_at: string
    role: 'assistant' | 'user'
    content: string
}
