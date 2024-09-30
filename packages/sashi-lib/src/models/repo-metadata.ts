export interface RepoFunctionMetadata {
    name: string
    description: string
    needConfirmation: boolean
    active?: boolean
}

export interface RepoMetadata {
    name: string
    description: string
    functions: RepoFunctionMetadata[]
}