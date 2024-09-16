import OpenAI from "openai"
import {AssistantTool} from "openai/resources/beta/assistants"
import {getFunctionRegistry} from "./ai-function-loader"

export class AIBot {
    private _apiKey: string

    constructor(apiKey: string) {
        this._apiKey = apiKey
    }

    private convertToOpenAIFunction = () => {
        const functions: AssistantTool[] = Array.from(
            getFunctionRegistry().values()
        ).map((func) => {
            return func.description() as AssistantTool
        })

        return functions
    }

    chatCompletion = async ({
        model = "gpt-3.5-turbo-1106",
        max_tokens = 2048,
        temperature = 0,
        messages
    }: {
        model?: string
        max_tokens?: number
        temperature?: number
        messages: any[]
    }) => {
        const openai = new OpenAI({apiKey: this._apiKey})
        let options = {messages, model, temperature, max_tokens} as any // Cast to any to allow dynamic properties

        const tools = this.convertToOpenAIFunction()
        if (tools?.length > 0) {
            options.tools = this.convertToOpenAIFunction()
        }

        try {
            const result = await openai.chat.completions.create(options)

            console.dir(result.choices[0])

            return result.choices[0]
        } catch (error: any) {
            console.log(error.name, error.message)

            throw error
        }
    }
}
