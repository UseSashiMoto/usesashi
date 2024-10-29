import axios from "axios"
import bodyParser from "body-parser"
import cors from "cors"
import {NextFunction, Request, Response, Router} from "express"
import {ParamsDictionary} from "express-serve-static-core"
import {ParsedQs} from "qs"
import {
    callFunctionFromRegistryFromObject,
    getFunctionAttributes,
    getFunctionRegistry,
    registerRepoFunctionsIntoAI,
    toggleFunctionActive,
    VisualizationFunction
} from "./ai-function-loader"
import {AIBot} from "./aibot"
import {RepoMetadata} from "./models/repo-metadata"
import {createSashiHtml} from "./utils"

const HEADER_API_TOKEN = "x-api-token"
const HEADER_REPO_TOKEN = "x-repo-token"

function getUniqueId() {
    return (
        Math.random().toString(36).substring(2) +
        new Date().getTime().toString(36)
    )
}

const getSystemPrompt = () => {
    const today = new Date()

    const system_prompt =
        `You are a helpful admin assistant for an application.\n\n` +
        `You job is to take user inquires and use the tools that we give you to help the users.\n` +
        `You will either use the current tool or list out the tools the user can use as a workflow a user can trigger\n` +
        `You might have to pass the response of one tool to a child tool and when you return result show parent tools and how it was passed to a child tool\n` +
        `When you fill up some of the required information yourself, be sure to confirm to user before proceeding.\n` +
        `Aside from the given tools, and manipulating the data, answer all other inquiries by telling the user that it is out of scope of your ability.\n\n` +
        "Do not make things up, do not guess, do not invent, do not use the tools to do things that are not asked for.\n\n" +
        `Do not run any function multiple times unless explicitly asked to do so or if a looping tool is detected and if so use the looping tools to loop through the function.\n\n` +
        `# User\n` +
        `If my full name is needed, please ask me for my full name.\n\n` +
        `# Language Support\n` +
        `Please reply in the language used by the user.\n\n` +
        `# Tools\n` +
        `You have access to the following tools:\n` +
        `${[...getFunctionRegistry().values()]
            .filter(
                (func) =>
                    getFunctionAttributes().get(func.getName())?.active ?? true
            )
            .map((func) => `${func.getName()}+":"+${func.getDescription()}`)
            .join("\n")}\n\n` +
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
    openAIKey: string
    repos?: string[]
    sashiServerUrl?: string //where the sashi server is hosted if you can't find it automatically
    apiSecretKey?: string // used to validate requests from and to the hub
    repoSecretKey?: string // used to upload metadata for a specific repo
    hubUrl?: string // hub where all the repos are hosted
    version?: number //current version of your repo
    addStdLib?: boolean // add the standard library to the hub
    useCloud?: boolean
    getSession?: (req: Request, res: Response) => Promise<string> // function to get the session id fot a request
}

export interface DatabaseClient {
    query: (operation: string, details: any) => Promise<any>
}

export const createMiddleware = (options: MiddlewareOptions) => {
    const {
        openAIKey,
        sashiServerUrl,
        apiSecretKey,
        repos = [],
        repoSecretKey,
        hubUrl = "https://hub.usesashi.com",
        version = 1,
        addStdLib = true,
        useCloud = true,
        getSession
    } = options

    if (addStdLib) {
        repos.push("sashi-stdlib")
    }

    const router = Router()
    // CORS middleware inside the router
    router.use((req, res, next) => {
        // Set CORS headers
        res.header("Access-Control-Allow-Origin", "*") // Or specific origins
        res.header(
            "Access-Control-Allow-Methods",
            "GET, POST, PUT, DELETE, OPTIONS"
        )
        res.header(
            "Access-Control-Allow-Headers",
            "x-sashi-session-token, Content-Type"
        )

        // If it's a preflight request (OPTIONS), respond immediately
        if (req.method === "OPTIONS") {
            return res.status(200).end()
        }

        next() // Continue to the next middleware or route handler
    })

    const aiBot = new AIBot({
        apiKey: openAIKey,
        sashiSecretKey: useCloud ? apiSecretKey : undefined,
        hubUrl
    })

    // Function to fetch metadata from all subscribed repositories
    const fetchMetadataFromRepos = async () => {
        if (!repos || !hubUrl) {
            return
        }
        try {
            const metadataPromises = repos.map((repoToken) =>
                axios.get<RepoMetadata>(
                    `${hubUrl}/metadata?repoToken=${repoToken}`,
                    {
                        headers: {
                            [HEADER_API_TOKEN]: apiSecretKey
                        }
                    }
                )
            )

            const metadataResponses = await Promise.all(metadataPromises)
            const metadataStore = metadataResponses.map((response, index) => ({
                data: response.data,
                token: repos[index] ?? ""
            }))

            for (const metadata of metadataStore) {
                for (const functionMetadata of metadata.data.functions) {
                    registerRepoFunctionsIntoAI(
                        functionMetadata,
                        metadata.token
                    )
                }
            }
        } catch (error) {
            console.error("no third-party metadata")
        }
    }

    const sendMetadataToHub = async () => {
        if (!hubUrl) {
            return
        }
        try {
            console.log("sending metadata to hub")
            const metadata: Partial<RepoMetadata> = {
                functions: Array.from(getFunctionRegistry().values()).map(
                    (func) => {
                        const functionAtribute = getFunctionAttributes().get(
                            func.getName()
                        )

                        return {
                            name: func.getName(),
                            description: func.getDescription(),
                            needConfirmation: func.getNeedsConfirm(),
                            active: functionAtribute?.active ?? true
                        }
                    }
                )
            }

            console.log("hub url metadata", `${hubUrl}/metadata`)
            await axios.post(
                `${hubUrl}/metadata`,
                {metadata, version},
                {
                    headers: {
                        [HEADER_API_TOKEN]: apiSecretKey
                    }
                }
            )
        } catch (error) {
            console.error(error)
            console.error(`No access to hub: ${hubUrl}/metadata`)
        }
    }

    // Fetch metadata during middleware initialization
    fetchMetadataFromRepos()
    sendMetadataToHub()
    router.use(cors())
    router.use(bodyParser.json())

    router.get("/sanity-check", (_req, res) => {
        res.json({message: "Sashi Middleware is running"})
        return
    })

    const validateRepoRequest = (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        const origin = req.headers.origin || ""
        const currentUrl = sashiServerUrl ?? req.get("host") ?? ""

        try {
            // Parse the origin and current URL to get the hostname
            const originUrl = new URL(origin)
            const currentUrlObj = new URL(`http://${currentUrl}`) // Ensure currentUrl is treated as a full URL

            // Check if both are localhost or if the origin matches the current domain
            const isLocalhost =
                originUrl.hostname === "localhost" &&
                currentUrlObj.hostname === "localhost"
            const isSameDomain = originUrl.hostname === currentUrlObj.hostname

            if (!isLocalhost && !isSameDomain) {
                // If they are not the same domain or both localhost, validate the secret key
                const secretKey = req.headers[HEADER_REPO_TOKEN]

                if (!secretKey || secretKey !== repoSecretKey) {
                    return res.status(403).json({error: "Unauthorized request"})
                }
            }

            // If authorized, proceed to the next middleware
            next()
        } catch (err) {
            console.error("Error parsing URLs:", err)
            return res.status(400).json({error: "Invalid origin or URL"})
        }
    }

    router.get("/metadata", validateRepoRequest, async (req, res) => {
        return res.json({
            functions: Array.from(getFunctionRegistry().values()).map(
                (func) => {
                    const functionAtribute = getFunctionAttributes().get(
                        func.getName()
                    )

                    return {
                        name: func.getName(),
                        description: func.getDescription(),
                        needConfirmation: func.getNeedsConfirm(),
                        active: functionAtribute?.active ?? true,
                        isVisualization: false
                    }
                }
            )
        })
    })

    router.get("/call-function", validateRepoRequest, async (req, res) => {
        const {functionName, args} = req.body

        if (!functionName) {
            return res.status(400).json({error: "Missing function name"})
        }

        const functionRegistry = getFunctionRegistry()
        const registeredFunction = functionRegistry.get(functionName)

        if (!registeredFunction) {
            return res.status(404).json({error: "Function not found"})
        }

        const parsedArgs = JSON.parse(args)
        const output = await callFunctionFromRegistryFromObject(
            functionName,
            parsedArgs
        )

        return res.json({output})
    })

    router.get("/functions/:function_id/toggle_active", async (req, res) => {
        const function_id = req.params.function_id
        const _function = getFunctionRegistry().get(function_id)
        if (!_function) {
            return res.status(404).json({message: "Function not found"})
        }

        toggleFunctionActive(function_id)

        res.json({message: "Function toggled"})
    })

    router.post("/chat", async (req, res) => {
        const {tools, previous, type} = req.body

        if (type === "/chat/function") {
            if (!Array.isArray(tools) || !Array.isArray(previous)) {
                return res.status(400).json({message: "Bad system prompt"})
            }

            let tools_output = []

            for (let tool of tools) {
                const funcName = tool.function?.name
                const functionArguments = JSON.parse(
                    tool.function?.arguments || "{}"
                )

                // Check if function name is missing
                if (!funcName) {
                    return res
                        .status(400)
                        .send("Missing function name in tool call.")
                }

                // Check if the tool needs confirmation
                const functionRegistry = getFunctionRegistry()
                const registeredFunction = functionRegistry.get(funcName)
                const needsConfirm =
                    registeredFunction?.getNeedsConfirm() || false

                if (needsConfirm && !tool.confirmed) {
                    tools_output.push({
                        tool_call_id: tool.id, // Use 'id' instead of 'tool_call_id'
                        id: tool.id, // Use 'id' instead of 'tool_call_id'
                        role: "tool",
                        type: "function",
                        content: `This tool (${funcName}) requires confirmation before it can be executed.`,
                        needsConfirm: true,
                        function: {
                            name: funcName,
                            arguments: tool.function?.arguments
                        },
                        args: JSON.stringify(functionArguments, null, 2)
                    })
                } else {
                    // Proceed with execution if no confirmation is needed
                    const output = await callFunctionFromRegistryFromObject(
                        funcName,
                        functionArguments
                    )

                    tools_output.push({
                        tool_call_id: tool.id, // Use 'id' instead of 'tool_call_id'
                        id: tool.id, // Use 'id' instead of 'tool_call_id'
                        role: "tool",
                        type: "function",
                        function: {
                            name: funcName,
                            arguments: tool.function?.arguments
                        },
                        content: JSON.stringify(output, null, 2)
                    })
                }
            }

            let context = trim_array(previous, 20)
            const system_prompt = getSystemPrompt()

            let messages: any[] = [{role: "system", content: system_prompt}]
            if (context.length > 0) {
                messages = messages.concat(context)
            }

            // Assistant's message includes tool_calls
            messages.push({
                role: "assistant",
                content: null,
                tool_calls: tools.map((tool: any) => ({
                    type: "function",
                    id: tool.id,
                    function: tool.function
                }))
            })

            messages.push(...tools_output)

            try {
                const result = await aiBot.chatCompletion({
                    temperature: 0.3,
                    messages: messages.filter(
                        (message) =>
                            typeof message.content !== "object" ||
                            message.content === null
                    )
                })

                const shouldShowVisualization =
                    await aiBot.shouldShowVisualization({
                        messages: [
                            ...messages,
                            {
                                id: getUniqueId(),
                                role: "assistant",
                                content: result?.message.content,
                                created_at: new Date().toISOString()
                            }
                        ],
                        viz_tools: Array.from(
                            getFunctionRegistry().values()
                        ).filter(
                            (func) => func instanceof VisualizationFunction
                        ) as unknown as VisualizationFunction[]
                    })

                res.json({
                    output: result?.message,
                    tool_calls: result?.message?.tool_calls,
                    visualization: shouldShowVisualization
                })
            } catch (error: any) {
                res.status(500).json({
                    message: "Error processing request",
                    error: error.message
                })
            }
        }
        if (type === "/chat/message") {
            const {inquiry, previous} = req.body

            let context = trim_array(previous, 20)
            const system_prompt = getSystemPrompt()

            let messages: any[] = [{role: "system", content: system_prompt}]
            if (context.length > 0) {
                messages = messages.concat(context)
            }
            messages.push({role: "user", content: inquiry})

            try {
                const result = await aiBot.chatCompletion({
                    temperature: 0.3,
                    messages: messages.filter(
                        (message) =>
                            typeof message.content !== "object" ||
                            message.content === null
                    )
                })

                res.json({
                    output: result?.message
                })
            } catch (error: any) {
                res.status(500).json({
                    message: "Error processing request",
                    error: error.message
                })
            }
        }
    })

    router.get("/", async (req, res) => {
        const newPath = `${
            sashiServerUrl ?? req.originalUrl.replace(/\/$/, "")
        }/bot`

        res.redirect(newPath)
        return
    })

    const createSessionToken = async (
        req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>,
        res: Response<any, Record<string, any>>
    ) => {
        if (getSession) {
            return await getSession(req, res)
        }

        const sessionToken = crypto.randomUUID()
        return sessionToken
    }

    router.use("/bot", async (req, res, next) => {
        const sessionToken = await createSessionToken(req, res)
        res.type("text/html").send(
            createSashiHtml(sashiServerUrl ?? req.baseUrl, sessionToken)
        )
        next()

        return
    })

    return router
}
