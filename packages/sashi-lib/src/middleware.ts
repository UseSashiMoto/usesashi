import bodyParser from "body-parser"
import cors from "cors"
import {Request, Response, Router} from "express"
import {
    callFunctionFromRegistryFromObject,
    getFunctionRegistry
} from "./ai-function-loader"
import {AIBot} from "./aibot"
import {validateSignedKey} from "./generate-token"
import {init} from "./init"
import {getAllConfigs, getConfig, setConfig} from "./manage-config"
import {createSashiHtml} from "./utils"

var path = require("path")

const getSystemPrompt = () => {
    const today = new Date()

    const system_prompt =
        `You are a helpful admin assistant for an application.\n\n` +
        `You job is to take user inquires and use the tools that we give you to help the users.\n` +
        `You will either use the current tool or list out the tools the user can use as a workflow a user can trigger\n` +
        `You might have to pass the response of one tool to a child tool and when you return result show parent tools and how it was passed to a child tool\n` +
        `When you fill up some of the required information yourself, be sure to confirm to user before proceeding.\n` +
        `Aside from the given functions above, answer all other inquiries by telling the user that it is out of scope of your ability.\n\n` +
        `# User\n` +
        `If my full name is needed, please ask me for my full name.\n\n` +
        `# Language Support\n` +
        `Please reply in the language used by the user.\n\n` +
        `# Tools\n` +
        `You have access to the following tools:\n` +
        `${[...getFunctionRegistry().values()].map((func) => `${func.getName()}+":"+${func.getDescription()}`).join("\n")}\n\n` +
        `when ask tell them they have access to those tools only and tell them they have no access to other tools\n\n` +
        `Today is ${today}`

    return system_prompt
}
export const isEven = (n: number) => {
    return n % 2 == 0
}
export const trim_array = (arr: string | any[], max_length = 20) => {
    let new_arr = arr

    if (arr.length > max_length) {
        let cutoff = Math.ceil(arr.length - max_length)
        cutoff = isEven(cutoff) ? cutoff : cutoff + 1

        new_arr = arr.slice(cutoff)
    }

    return new_arr
}

interface MiddlewareOptions {
    databaseUrl?: string // Connection string for the database
    redisUrl?: string
    accountId: string // Header name to extract the account ID from request headers
    secretKey: string
    openAIKey: string
    sashiServerUrl?: string //where the sashi server is hosted if you can't find it automatically
}

export interface DatabaseClient {
    query: (operation: string, details: any) => Promise<any>
}

export const createMiddleware = (options: MiddlewareOptions) => {
    const {
        databaseUrl,
        redisUrl,
        openAIKey,
        accountId = "account-id",
        sashiServerUrl,
        secretKey
    } = options

    init({accountId, databaseUrl, redisUrl})
    const router = Router()

    const aiBot = new AIBot(openAIKey)

    router.use(cors())
    router.use(bodyParser.json())

    router.get("/sanity-check", (_req, res) => {
        res.json({message: "Sashi Middleware is running"})
        return
    })
    // Get data endpoint
    router.get("/configs/:key", async (req: Request, res: Response) => {
        const key: string = req.params.key as string

        const accountkey: string | undefined = req.headers[
            "account-key"
        ] as string

        const accountSignature: string | undefined = req.headers[
            "account-signature"
        ] as string

        if (!validateSignedKey(accountkey, accountSignature, secretKey)) {
            res.sendStatus(401).send("Unauthorized")
            return
        }

        if (!accountId) {
            return res
                .status(400)
                .json({message: "Account ID is required in headers"})
        }
        try {
            const {value} = await getConfig(key)
            res.json({key, value})
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to retrieve data",
                error: error.message
            })
        }
    })

    router.get("/configs", async (req: Request, res: Response) => {
        const accountkey: string | undefined = req.headers[
            "account-key"
        ] as string

        const accountSignature: string | undefined = req.headers[
            "account-signature"
        ] as string

        if (!validateSignedKey(accountkey, accountSignature, secretKey)) {
            res.sendStatus(401).send("Unauthorized")
            return
        }

        if (!accountId) {
            return res
                .status(400)
                .json({message: "Account ID is required in headers"})
        }

        try {
            const data = await getAllConfigs()

            res.json(data)
        } catch (error: any) {
            console.error("error", error.message)
            res.status(500).json({
                message: "Failed to retrieve data",
                error: error.message
            })
        }
    })

    // Set data endpoint
    router.post("/configs/:key", async (req: Request, res: Response) => {
        const key: string = req.params.key as string

        const accountkey: string | undefined = req.headers[
            "account-key"
        ] as string

        const accountSignature: string | undefined = req.headers[
            "account-signature"
        ] as string

        if (!validateSignedKey(accountkey, accountSignature, secretKey)) {
            res.sendStatus(401).send("Unauthorized")
            return
        }

        const {value} = req.body

        if (!accountId) {
            return res
                .status(400)
                .json({message: "Account ID is required in headers"})
        }

        try {
            await setConfig(key, value)
            res.json({key, value})
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to store data",
                error: error.message
            })
        }
    })

    // Endpoint to validate the key and signed key
    router.post("/validate-key", (req, res) => {
        const key = req.headers["account-key"] as string
        const signature = req.headers["account-signature"] as string
        const validated = validateSignedKey(key, signature, secretKey)

        res.json({valid: validated})
    })

    router.post("/chat", async (req, res) => {
        const {tools, previous, type} = req.body

        console.log("type", type)
        if (type === "/chat/function") {
            if (!Array.isArray(tools) || !Array.isArray(previous)) {
                return new Response("Bad system prompt", {
                    status: 400
                })
            }

            let tools_output = []

            for (let tool of tools) {
                const funcName = tool.function.name

                const functionArguments = JSON.parse(tool.function.arguments)
                const output = await callFunctionFromRegistryFromObject(
                    funcName,
                    functionArguments
                )

                const tool_output = output

                tools_output.push({
                    tool_call_id: tool.id,
                    role: "tool",
                    name: tool.function.name,
                    content: JSON.stringify(tool_output, null, 2)
                })
            }

            let context = trim_array(previous, 20)

            const today = new Date()

            const system_prompt = getSystemPrompt()

            let messages: any[] = [{role: "system", content: system_prompt}]
            if (context.length > 0) {
                messages = messages.concat(context)
            }

            messages.push({role: "assistant", content: null, tool_calls: tools})
            for (let output_item of tools_output) {
                messages.push(output_item)
            }

            let result_message = null

            try {
                console.log("before chatCompletion")

                let result = await aiBot.chatCompletion({
                    temperature: 0.3,
                    messages
                })

                console.log("after chatCompletion")

                result_message = result?.message
                res.json({
                    output: result_message
                })
                return
            } catch (error: any) {
                console.log(
                    "chatCompletion function error",
                    error.name,
                    error.message,
                    req.body
                )
                console.log("chatCompletion function error #2", messages)
            }
        }

        if (type === "/chat/message") {
            const {inquiry, previous} = await req.body

            let context = trim_array(previous, 20)

            const today = new Date()

            const system_prompt = getSystemPrompt()

            let messages: any[] = [{role: "system", content: system_prompt}]
            if (context.length > 0) {
                messages = messages.concat(context)
            }
            messages.push({role: "user", content: inquiry})

            let result_message = null

            try {
                console.log("before chatCompletion", messages)
                const result = await aiBot.chatCompletion({
                    temperature: 0.3,
                    messages
                })
                console.log("after chatCompletion")

                result_message = result?.message

                res.json({
                    output: result_message
                })

                return
            } catch (error: any) {
                console.log(
                    "chatCompletion message error",
                    error.name,
                    error.message,
                    req.body
                )

                console.log("chatCompletion message error #2", messages)
            }
        }
    })

    router.get("/", async (req, res) => {
        const newPath = `${sashiServerUrl ?? req.originalUrl.replace(/\/$/, "")}/bot`

        res.redirect(newPath)
        return
    })

    router.use("/bot", async (req, res, next) => {
        res.type("text/html").send(
            createSashiHtml(sashiServerUrl ?? req.baseUrl)
        )
        next()

        return
    })

    return router
}
