import { observeOpenAI } from "langfuse"
import OpenAI from "openai"
import {
    getFunctionAttributes,
    getFunctionRegistry,
    VisualizationFunction,
    VisualizationType
} from "./ai-function-loader"

export class AIBot {
    private _apiKey: string
    private _sashiSecretKey?: string
    private _hubUrl?: string
    openai: OpenAI

    constructor({
        apiKey,
        sashiSecretKey,
        hubUrl,
        langFuseInfo,
    }: {
        apiKey: string
        sashiSecretKey?: string
        hubUrl?: string
        langFuseInfo?: { publicKey: string; secretKey: string; baseUrl: string }
    }) {
        this._apiKey = apiKey
        this._sashiSecretKey = sashiSecretKey
        this._hubUrl = hubUrl

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
        return `You are a simple AI assistant. Your goal is to output a boolean flag (true or false) indicating whether or not a UI component should be generated. A user should have to explicitly ask for visualization, you should make that decisison based on if it would help the user better contextualize the conversation or results from a tool call. For most cases of a user having tool results you should show a visualziation for example if he asks for a list of items it should be displayed in a table or if he asks for a single piece of data it should be shown in a data card.
to make i easier to understand your information, you will be given a list of available components and the existing message history.
First you will reason about whether you think a component should be generated. Reasoning should be a single sentence and output between <reasoning></reasoning> tags.
Then you will output a boolean flag (true or false) <decision></decision> tags.
Finally, if you decide that a component should be generated, you will output the name of the component between <component></component> tags.`
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

        const tool_calls = result?.message?.tool_calls?.map((tool: { function: { name: any; arguments: string } }) => {
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

            const decisionResponse = result?.message?.content
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

        console.log("messages sending to openai", messages.map((m) => m.content.length))
        let options: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
            messages,
            model,
            max_tokens,
            temperature
        }


        if (tool_choice) {
            options.tool_choice = tool_choice
        }

        try {
            // Add timeout wrapper to prevent hanging
            const openaiTimeout = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('OPENAI_API_TIMEOUT')), 40000); // 40 second timeout
            });

            const openaiCallPromise = this.openai.chat.completions.create(options);

            const result = await Promise.race([openaiCallPromise, openaiTimeout]);

            if (!result || !result.choices || !result.choices[0]) {
                console.error("Invalid response from OpenAI:", result);
                throw new Error('Invalid response structure from OpenAI API');
            }

            return result.choices[0]

        } catch (error: any) {
            console.error("Error in chatCompletion:", error)

            // Handle specific timeout error
            if (error.message === 'OPENAI_API_TIMEOUT') {
                throw new Error('AI service timeout - the request took too long to process');
            }

            // Re-throw the original error with more context
            throw error
        }
    }
}


let aiBot: AIBot | null = null

export const createAIBot = ({ apiKey, sashiSecretKey, hubUrl }: { apiKey: string, sashiSecretKey?: string, hubUrl: string }) => {
    aiBot = new AIBot({ apiKey, sashiSecretKey, hubUrl })
}

export const getAIBot = () => {
    if (!aiBot) {
        throw new Error("AIBot not initialized")
    }

    return aiBot
}