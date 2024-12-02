export interface RepoFunctionMetadata {
    name: string
    description: string
    needConfirmation: boolean
    active?: boolean
}

export interface RepoMetadata {
    id: string
    name: string
    description: string
    functions: RepoFunctionMetadata[]
}

export interface MetaData {
    hubUrl: string
    functions: RepoFunctionMetadata[]
}
