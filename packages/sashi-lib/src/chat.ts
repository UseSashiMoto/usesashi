import { callFunctionFromRegistryFromObject, getFunctionAttributes, getFunctionRegistry, VisualizationFunction } from "./ai-function-loader";
import { getAIBot } from "./aibot";
import { trim_array } from "./utils";


export function getUniqueId() {
    return (
        Math.random().toString(36).substring(2) +
        new Date().getTime().toString(36)
    )
}

const getSystemPrompt = () => {
    const today = new Date();

    const system_prompt =
        `You are a helpful admin assistant for an application.\n\n` +
        `You job is to take user inquires and use the tools that we give you to help the users.\n` +
        `You will either use the current tool or list out the tools the user can use as a workflow a user can trigger\n` +
        `You might have to pass the response of one tool to a child tool and when you return result show parent tools and how it was passed to a child tool\n` +
        `When you fill up some of the required information yourself, be sure to confirm to user before proceeding.\n` +
        `Aside from the given tools, and manipulating the data, answer all other inquiries by telling the user that it is out of scope of your ability.\n\n` +
        'Do not make things up, do not guess, do not invent, do not use the tools to do things that are not asked for.\n\n' +
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
            .join('\n')}\n\n` +
        `when ask tell them they have access to those tools only and tell them they have no access to other tools\n\n` +
        `Today is ${today}`;

    return system_prompt;
};


export const processChatRequest = async ({ inquiry, previous }: { inquiry: string, previous: any[] }) => {
    const aiBot = getAIBot()

    const context = trim_array(previous, 20);
    const system_prompt = getSystemPrompt();

    let messages: any[] = [{ role: 'system', content: system_prompt }];
    if (context.length > 0) {
        messages = messages.concat(context);
    }
    messages.push({ role: 'user', content: inquiry });

    const result = await aiBot.chatCompletion({
        temperature: 0.3,
        messages: messages.filter(
            (message) =>
                typeof message.content !== "object" ||
                message.content === null
        )
    })

    return result
}

export const processFunctionRequest = async ({ tools, previous }: { tools: any[], previous: any[] }) => {
    const aiBot = getAIBot()

    if (!Array.isArray(tools) || !Array.isArray(previous)) {
        throw new Error('Bad system prompt');
    }

    const tools_output = [];


    for (let tool of tools) {
        const funcName = tool.function?.name;
        const functionArguments = JSON.parse(
            tool.function?.arguments || '{}'
        );

        // Check if function name is missing
        if (!funcName) {
            throw new Error('Missing function name in tool call.');
        }

        // Check if the tool needs confirmation
        const functionRegistry = getFunctionRegistry();
        const registeredFunction = functionRegistry.get(funcName);
        const needsConfirm =
            registeredFunction?.getNeedsConfirm() || false;

        if (needsConfirm && !tool.confirmed) {
            tools_output.push({
                tool_call_id: tool.id, // Use 'id' instead of 'tool_call_id'
                id: tool.id, // Use 'id' instead of 'tool_call_id'
                role: 'tool',
                type: 'function',
                content: `This tool (${funcName}) requires confirmation before it can be executed.`,
                needsConfirm: true,
                function: {
                    name: funcName,
                    arguments: tool.function?.arguments,
                },
                args: JSON.stringify(functionArguments, null, 2),
            });
        } else {
            // Proceed with execution if no confirmation is needed
            const output = await callFunctionFromRegistryFromObject(
                funcName,
                functionArguments
            );

            tools_output.push({
                tool_call_id: tool.id, // Use 'id' instead of 'tool_call_id'
                id: tool.id, // Use 'id' instead of 'tool_call_id'
                role: 'tool',
                type: 'function',
                function: {
                    name: funcName,
                    arguments: tool.function?.arguments,
                },
                content: JSON.stringify(output, null, 2),
            });
        }
    }

    const context = trim_array(previous, 20);
    const system_prompt = getSystemPrompt();

    let messages: any[] = [{ role: 'system', content: system_prompt }];
    if (context.length > 0) {
        messages = messages.concat(context);
    }

    // Assistant's message includes tool_calls
    messages.push({
        role: 'assistant',
        content: null,
        tool_calls: tools.map((tool: any) => ({
            type: 'function',
            id: tool.id,
            function: tool.function,
        })),
    });

    messages.push(...tools_output);

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


        return {
            output: result?.message,
            tool_calls: result?.message?.tool_calls,
            visualization: shouldShowVisualization
        }
    } catch (error: any) {
        throw new Error('Error processing request');

    }
}