import OpenAI from "openai"
import {ChatCompletionTool} from "openai/resources"
import {AssistantTool} from "openai/resources/beta/assistants"
import {
    getFunctionAttributes,
    getFunctionRegistry,
    VisualizationFunction,
    VisualizationType
} from "./ai-function-loader"

export class AIBot {
    private _apiKey: string
    openai: OpenAI

    constructor(apiKey: string) {
        this._apiKey = apiKey
        this.openai = new OpenAI({apiKey: this._apiKey})
    }

    private convertToOpenAIFunction = () => {
        const functions: AssistantTool[] = Array.from(
            getFunctionRegistry().values()
        )
            .filter(
                (func) =>
                    getFunctionAttributes().get(func.getName())?.active ?? true
            )
            .map((func) => {
                return func.description() as AssistantTool
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

        const result = await this.openai.chat.completions.create({
            messages: [
                {role: "system", content: generateComponentPrompt},
                ...messages
            ],
            model,
            temperature,
            max_tokens,
            tools: [component?.description() as ChatCompletionTool],
            tool_choice: {type: "function", function: {name: componentName}}
        })

        const tool_calls = result.choices[0]?.message.tool_calls?.map(
            (tool) => {
                return {
                    name: tool.function.name,
                    type: component.getVisualizationType(),
                    parameters: JSON.parse(tool.function.arguments)
                }
            }
        )

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
            const system_prompt = this.getUXSystemPrompt(viz_tools)

            const viz_messages = [
                {role: "system", content: system_prompt},
                {
                    role: "user",
                    content: `<availableComponents>
               ${JSON.stringify(viz_tools)}
                </availableComponents>
                `
                },
                ...messages
            ]

            const result = await this.openai.chat.completions.create({
                messages: viz_messages,
                model,
                temperature,
                max_tokens
            })

            const decisionResponse = result?.choices[0]?.message.content
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

                return await this.setupComponent({messages, componentName})
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
        model = "gpt-4o",
        max_tokens = 2048,
        temperature = 0,
        messages
    }: {
        model?: string
        max_tokens?: number
        temperature?: number
        messages: any[]
    }) => {
        let options = {messages, model, temperature, max_tokens} as any // Cast to any to allow dynamic properties

        const tools = this.convertToOpenAIFunction()
        if (tools?.length > 0) {
            options.tools = this.convertToOpenAIFunction()
        }

        try {
            const result = await this.openai.chat.completions.create(options)

            console.log("result", JSON.stringify(result.choices[0], null, 2))

            return result.choices[0]
        } catch (error: any) {
            console.log(error.name, error.message)

            throw error
        }
    }
}
