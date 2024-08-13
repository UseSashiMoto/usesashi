//@ts-ignore
import "openai/shims/node"

import OpenAI from "openai"
import {
    AIFunction,
    AIObject,
    callFunctionFromRegistryFromObject,
    getFunctionRegistry
} from "./ai-function-loader"

import {AssistantTool} from "openai/resources/beta/assistants"

const AddFunction = new AIFunction("add", "Adds two numbers")
    .args(
        {
            name: "a",
            description: "First number to add",
            type: "number",
            required: true
        },
        {
            name: "b",
            description: "Second number to add",
            type: "number",
            required: true
        }
    )
    .returns({
        name: "result",
        type: "number",
        description: "The sum of the two numbers"
    })
    .implement((a: number, b: number) => {
        return a + b
    })

const SubtractObject = new AIObject(
    "Subtract_Object",
    "two number for subtracting in json object",
    true
)
    .field({
        name: "a",
        type: "number",
        description: "The first number to subtract",
        required: true
    })
    .field({
        name: "b",
        type: "number",
        description: "The second number to subtract",
        required: true
    })

const SubtractObjectFunction = new AIFunction(
    "subtract",
    "Subtracts two numbers"
)
    .args(SubtractObject)
    .returns({
        name: "result",
        type: "number",
        description: "The difference of the two numbers"
    })
    .implement((addObject: {a: number; b: number}) => {
        return addObject.a - addObject.b
    })

const convertToOpenAIFunction = () => {
    const functions: AssistantTool[] = Array.from(
        getFunctionRegistry().values()
    ).map((func) => {
        return func.description() as AssistantTool
    })

    return functions
}
const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY})

let intervalId: NodeJS.Timeout
async function askOpenAI(question: string) {
    const functions = convertToOpenAIFunction()

    console.log("functions printing", JSON.stringify(functions))
    const assistent = await openai.beta.assistants.create({
        instructions:
            "You Admin tools for startups. You have access to functions in our system that you can use to solve issue",
        model: "gpt-4o",
        tools: functions
    })

    const thread = await openai.beta.threads.create()

    // create a run with custom instructions
    const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistent.id,
        instructions:
            "You Admin tools for startups. You help by answer questions and calling functions inside their infrastrure to do tasks or create workflows for those tasks using functions givin to you"
    })
    intervalId = setInterval(() => {
        checkStatusAndPrintMessages(thread.id, run.id)
    }, 1000)
}

// Function to check run status and print messages
const checkStatusAndPrintMessages = async (threadId: string, runId: string) => {
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, runId)
    if (runStatus.status === "completed") {
        let messages = await openai.beta.threads.messages.list(threadId)
        messages.data.forEach((msg) => {
            console.log("message content", msg.content)
            const role = msg.role
            //@ts-ignore
            const content = msg.content[0].text.value
            console.log(
                `${role.charAt(0).toUpperCase() + role.slice(1)}: ${content}`
            )
        })
        console.log("Run is completed.")
        clearInterval(intervalId)
    } else if (runStatus.status === "requires_action") {
        console.log("Requires action")
        const requiredActions =
            runStatus.required_action?.submit_tool_outputs.tool_calls ?? []
        console.log(requiredActions)

        let toolsOutput = []

        for (const action of requiredActions) {
            const funcName = action.function.name
            const functionArguments = JSON.parse(action.function.arguments)
            console.log("functionArguments", functionArguments)
            if (getFunctionRegistry().has(funcName)) {
                try {
                    const output = await callFunctionFromRegistryFromObject(
                        funcName,
                        functionArguments
                    )
                    toolsOutput.push({
                        tool_call_id: action.id,
                        output: JSON.stringify(output)
                    })
                } catch (error) {
                    console.log(
                        `Error executing function ${funcName}: ${error}`
                    )
                }
            } else {
                console.log("Function not found")
            }
        }

        await openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
            tool_outputs: toolsOutput
        })
    } else {
        console.log("Run is not completed yet.")
    }
}

export async function chatCompletion({
    model = "gpt-3.5-turbo-1106",
    max_tokens = 2048,
    temperature = 0,
    messages
}: {
    model?: string
    max_tokens?: number
    temperature?: number
    messages: any[]
}) {
    let options = {messages, model, temperature, max_tokens} as any // Cast to any to allow dynamic properties

    options.tools = convertToOpenAIFunction()

    try {
        const result = await openai.chat.completions.create(options)

        console.log(result)

        return result.choices[0]
    } catch (error: any) {
        console.log(error.name, error.message)

        throw error
    }
}

//registerFunctionIntoAI("add", AddFunction)
//registerFunctionIntoAI("subtract", SubtractObjectFunction)

// Example usage
//askOpenAI("Please add 3 and 5.")
//askOpenAI("Please subtract 3 and 5.")
        