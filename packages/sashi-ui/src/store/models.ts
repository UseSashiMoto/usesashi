export type MessageItem = {
    id: string
    created_at: string
    role: "assistant" | "user"
    content: string
}

export type FunctionMetadata = {
    name: string
    description: string
    needConfirmation: boolean
}

export type Metadata = {
    name: string
    description: string
    functions: FunctionMetadata[]
}
