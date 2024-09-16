import bodyParser from "body-parser"
import cors from "cors"
import { Router } from "express"
import {
    callFunctionFromRegistryFromObject,
    getFunctionRegistry
} from "./ai-function-loader"
import { AIBot } from "./aibot"
import { createSashiHtml } from "./utils"

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
    
    openAIKey: string
    sashiServerUrl?: string //where the sashi server is hosted if you can't find it automatically
}

export interface DatabaseClient {
    query: (operation: string, details: any) => Promise<any>
}

export const createMiddleware = (options: MiddlewareOptions) => {
    const {

        openAIKey,
        sashiServerUrl,
    } = options

    const router = Router()

    const aiBot = new AIBot(openAIKey)

    router.use(cors())
    router.use(bodyParser.json())

    router.get("/sanity-check", (_req, res) => {
        res.json({message: "Sashi Middleware is running"})
        return
    })


    router.get("/metadata", async (req, res) => {


        return res.json({
            name: "Sashimoto Chatbot",
            functions: Array.from(getFunctionRegistry().values()).map((func) => {
                return {
                    name: func.getName(),
                    description: func.getDescription(),
                    needConfirmation: func.getNeedsConfirm()
                }
            })
        })
    })

    router.post("/chat", async (req, res) => {
        const { tools, previous, type } = req.body;

    
        if (type === "/chat/function") {
            if (!Array.isArray(tools) || !Array.isArray(previous)) {
              return res.status(400).json({ message: "Bad system prompt" });
            }
        
            let tools_output = [];
        
            for (let tool of tools) {
              const funcName = tool.function?.name;
              const functionArguments = JSON.parse(tool.function?.arguments || "{}");
        
              // Check if function name is missing
              if (!funcName) {
                return res.status(400).send("Missing function name in tool call.");
              }
        
              // Check if the tool needs confirmation
              const functionRegistry = getFunctionRegistry();
              const registeredFunction = functionRegistry.get(funcName);
              const needsConfirm = registeredFunction?.getNeedsConfirm() || false;
        
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
                    arguments:tool.function?.arguments
                  },
                  args: JSON.stringify(functionArguments, null, 2),
                });
              } else {
                // Proceed with execution if no confirmation is needed
                const output = await callFunctionFromRegistryFromObject(funcName, functionArguments);
        
                tools_output.push({
                  tool_call_id: tool.id, // Use 'id' instead of 'tool_call_id'
                  id: tool.id, // Use 'id' instead of 'tool_call_id'
                  role: "tool",
                  type: "function",
                  function: {
                    name: funcName,
                    arguments:tool.function?.arguments
                  },
                  content: JSON.stringify(output, null, 2),
                });
              }
            }
        
            let context = trim_array(previous, 20);
            const system_prompt = getSystemPrompt();
        
            let messages: any[] = [{ role: "system", content: system_prompt }];
            if (context.length > 0) {
              messages = messages.concat(context);
            }
        
            // Assistant's message includes tool_calls
            messages.push({
              role: "assistant",
              content: null,
              tool_calls: tools.map((tool: any) => ({
                type: "function",
                id: tool.id,
                function: tool.function,
              }))
            });

            messages.push(...tools_output);

        
            try {
              const result = await aiBot.chatCompletion({
                temperature: 0.3,
                messages,
              });
        
              res.json({
                output: result?.message,
                tool_calls: result?.message?.tool_calls,
              });
            } catch (error:any) {
              res.status(500).json({ message: "Error processing request", error: error.message });
            }
          }
        if (type === "/chat/message") {
            const { inquiry, previous } = req.body;
    
            let context = trim_array(previous, 20);
            const system_prompt = getSystemPrompt();
    
            let messages: any[] = [{ role: "system", content: system_prompt }];
            if (context.length > 0) {
                messages = messages.concat(context);
            }
            messages.push({ role: "user", content: inquiry });
    
            try {
                const result = await aiBot.chatCompletion({
                    temperature: 0.3,
                    messages,
                });
    
                res.json({
                    output: result?.message,
                });
            } catch (error:any) {
                res.status(500).json({ message: "Error processing request", error: error.message });
            }
        }
    });

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
