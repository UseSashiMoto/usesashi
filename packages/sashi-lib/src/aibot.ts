import { observeOpenAI } from "langfuse"
import OpenAI from "openai"
import {
    getFunctionAttributes,
    getFunctionRegistry,
    VisualizationFunction,
    VisualizationType
} from "./ai-function-loader"
import { HEADER_API_TOKEN } from "./utils/constants"

export class AIBot {
    private _apiKey: string
    private _sashiSecretKey?: string
    private _hubUrl?: string
    private _useCloud: boolean
    openai: OpenAI

    constructor({
        apiKey,
        sashiSecretKey,
        hubUrl,
        langFuseInfo,
        useCloud = false
    }: {
        apiKey: string
        sashiSecretKey?: string
        hubUrl?: string
        langFuseInfo?: { publicKey: string; secretKey: string; baseUrl: string }
        useCloud?: boolean
    }) {
        this._apiKey = apiKey
        this._sashiSecretKey = sashiSecretKey
        this._hubUrl = hubUrl
        this._useCloud = useCloud

        if (langFuseInfo) {
            this.openai = observeOpenAI(new OpenAI({ apiKey: this._apiKey }), {
                clientInitParams: {
                    publicKey: langFuseInfo.publicKey,
                    secretKey: langFuseInfo.secretKey,
                    baseUrl: langFuseInfo.baseUrl
                }
            })
        } else {
            this.openai = new OpenAI({ apiKey: this._apiKey })
        }
    }

    private convertToOpenAIFunction = () => {
        const functions: OpenAI.Chat.Completions.ChatCompletionTool[] = Array.from(
            getFunctionRegistry().values()
        )
            .filter(
                (func) =>
                    getFunctionAttributes().get(func.getName())?.active ?? true
            )
            .map((func) => {
                return func.description() as OpenAI.Chat.Completions.ChatCompletionTool
            })

        return functions
    }

    getUXSystemPrompt = () => {
        return `You are an AI assistant specialized in generating UI components for workflows. Your goal is to analyze the conversation and workflow to determine the most appropriate UI components to display.

When deciding whether to generate a UI component, consider:
1. Is this part of a workflow that would benefit from visualization?
2. Would a form help users input workflow parameters?
3. Would a visualization help users understand the workflow results?
4. Is this a step in a multi-step workflow that needs its own UI?

For workflow steps, you should generate:
- Forms for input parameters
- Progress indicators for multi-step workflows
- Visualizations for intermediate and final results
- Navigation elements for workflow steps

First, reason about whether a component should be generated. Output your reasoning between <reasoning></reasoning> tags.
Then output your decision (true/false) between <decision></decision> tags.
If true, output the component name between <component></component> tags.`
    }

    setupComponent = async ({
        messages,
        componentName,
        model = "gpt-4o-mini",
        max_tokens = 2048,
        temperature = 0
    }: {
        componentName: string
        messages: any[]
        model?: string
        max_tokens?: number
        temperature?: number
    }) => {
        const hasComponent = getFunctionRegistry().has(componentName)
        if (!hasComponent) {
            throw new Error("Component not found")
        }

        const component = getFunctionRegistry().get(
            componentName
        ) as VisualizationFunction

        if (!component || !component.getVisualizationType()) {
            throw new Error("Component not found")
        }

        const generateComponentPrompt = `You are an AI assistant that interacts with users and helps them perform display component to help them visualize data.
     To help the user perform these task, you are able to generate UI components. you are giving the UI element as a tool and the parameters it taks. 
     When prompted, you will be given the existing conversation history, followed by the component to display, its description provided by the user, the shape of any props to pass in, and any other related context.
     Use the conversation history to determine based on the last message what data should be passed to the tool ${componentName} based on the context provided.
     `

        const result = await this.chatCompletion({
            messages: [
                { role: "system", content: generateComponentPrompt },
                ...messages
            ],
            model,
            temperature,
            max_tokens,
            tool_choice: { type: "function", function: { name: componentName } }
        })

        const tool_calls = result.tool_calls?.map((tool: { function: { name: any; arguments: string } }) => {
            return {
                name: tool.function.name,
                type: component.getVisualizationType(),
                parameters: JSON.parse(tool.function.arguments)
            }
        })

        return tool_calls
    }

    shouldShowVisualization = async ({
        messages,
        viz_tools,
        model = "gpt-4o-mini",
        max_tokens = 2048,
        temperature = 0
    }: {
        messages: any[]
        viz_tools: VisualizationFunction[]
        model?: string
        max_tokens?: number
        temperature?: number
    }): Promise<
        | {
            name: string
            type: VisualizationType
            parameters: any
        }[]
        | null
        | undefined
    > => {
        try {
            const system_prompt = this.getUXSystemPrompt()

            const viz_messages = [
                { role: "system", content: system_prompt },
                {
                    role: "user",
                    content: `<availableComponents>
               ${JSON.stringify(viz_tools)}
                </availableComponents>
                `
                },
                ...messages
            ]

            const result = await this.chatCompletion({
                messages: viz_messages,
                model,
                temperature,
                max_tokens
            })

            const decisionResponse = result.content
            const shouldGenerate = decisionResponse?.match(
                /<decision>(.*?)<\/decision>/
            )?.[1]

            if (shouldGenerate === "true") {
                const componentName = decisionResponse?.match(
                    /<component>(.*?)<\/component>/
                )?.[1]

                if (!componentName) {
                    throw new Error("Invalid component name")
                }

                return await this.setupComponent({ messages, componentName })
            }

            if (shouldGenerate === "false") {
                return
            }
            return
        } catch (e) {
            console.log(e)
            return null
        }
    }

    chatCompletion = async ({
        model = "gpt-4",
        max_tokens = 2048,
        temperature = 0,
        messages,
        tool_choice
    }: {
        model?: string
        max_tokens?: number
        temperature?: number
        messages: any[]
        tool_choice?: any
    }) => {
        let options: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
            messages,
            model,
            max_tokens,
            temperature
        }

        const tools = this.convertToOpenAIFunction()
        if (tools?.length > 0) {
            options.tools = tools
        }

        if (tool_choice) {
            options.tool_choice = tool_choice
        }

        try {
            if (this._useCloud && this._sashiSecretKey && this._hubUrl) {
                console.log("Sending request to cloud at:", this._hubUrl)
                console.log("Request options:", JSON.stringify(options, null, 2))

                const response = await fetch(`${this._hubUrl}/chatCompletion`, {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                        [HEADER_API_TOKEN]: this._sashiSecretKey
                    },
                    body: JSON.stringify(options)
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    throw new Error(`Network response was not ok: ${response.statusText} - ${errorText}`)
                }

                const responseData = await response.json()
                console.log("Received response from cloud:", JSON.stringify(responseData, null, 2))
                return responseData.choices[0]
            } else {
                console.log("Sending request directly to OpenAI API", this._useCloud, this._sashiSecretKey, this._hubUrl)
                const result = await this.openai.chat.completions.create(options)
                console.log("Received response from OpenAI:", JSON.stringify(result, null, 2))
                return result.choices[0]
            }
        } catch (error: any) {
            console.error("Error in chatCompletion:", error)
            throw error
        }
    }
}


let aiBot: AIBot | null = null

export const createAIBot = ({ apiKey, sashiSecretKey, hubUrl, useCloud }: { apiKey: string, sashiSecretKey?: string, hubUrl: string, useCloud: boolean }) => {
    aiBot = new AIBot({ apiKey, sashiSecretKey, hubUrl, useCloud })
}

export const getAIBot = () => {
    if (!aiBot) {
        throw new Error("AIBot not initialized")
    }

    return aiBot
}