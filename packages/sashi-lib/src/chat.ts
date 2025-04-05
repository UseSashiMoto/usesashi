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
        `You are a helpful workflow builder and UI generator assistant.\n\n` +
        `Your primary tasks are:\n` +
        `1. Help users build workflows by chaining together available functions\n` +
        `2. Show a preview of the workflow before execution\n` +
        `3. Offer options to either execute the workflow or create a permanent UI\n\n` +
        `When building workflows:\n` +
        `- Break down the user's request into logical steps\n` +
        `- Identify which functions can be used for each step\n` +
        `- Show how data flows between functions\n` +
        `- Present the workflow as a preview with:\n` +
        `  * Step-by-step breakdown\n` +
        `  * Function names and descriptions\n` +
        `  * Data flow between steps\n` +
        `  * Expected inputs and outputs\n\n` +
        `After showing the preview, offer two options:\n` +
        `1. Execute the workflow now\n` +
        `2. Create a permanent UI for this workflow\n\n` +
        `You have access to the following tools:\n` +
        `${[...getFunctionRegistry().values()]
            .filter(
                (func) =>
                    getFunctionAttributes().get(func.getName())?.active ?? true
            )
            .map((func) => `${func.getName()}+":"+${func.getDescription()}`)
            .join('\n')}\n\n` +
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