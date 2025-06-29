import { callFunctionFromRegistryFromObject, generateSplitToolSchemas, getFunctionRegistry, VisualizationFunction } from "./ai-function-loader";
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
        `
    You are an assistant capable of two distinct response types based on the user's request:\n
    ## Response Type 1: General Conversation\n
    If the user's message is conversational, informational, 
    or does NOT explicitly request a workflow involving backend functions, respond clearly and concisely using this JSON format:\n

    {
        "type": "general",
        "content": "<your natural conversational response here>"
    }

    ## Response Type 2: Workflow Definition
    If the user's message explicitly requests or clearly describes a workflow involving backend functions or tasks, 
    respond strictly in structured JSON format as follows:\n

    {
        "type": "workflow",
        "description": "<short description of workflow>",
        "actions": [
            {
                "id": "<unique_action_id>",
                "tool": "<backend_function_name the list of tools is available in the tool_schema and each has a name, description and parameters. use name here>",
                "description": "<description of the action>",
                "parameters": {
                    "<parameter_name>": "<parameter_value_or_reference>"
                },
                "parameterMetadata": {
                    "<parameter_name>": {
                        "type": "string",
                        "description": "description from the tool schema",
                        "enum": ["value1", "value2"],  // Include if parameter has enum values
                        "required": true
                    }
                },
                "map": false
            }
        ]
    }

    Important rules for Workflow responses:
    - ONLY use functions that exist in the tool_schema. NEVER make up or use functions that don't exist.
    - For parameters that have an "enum" field in their schema, you MUST:
      1. Include the enum values in parameterMetadata for that parameter
      2. ONLY use values from the enum list in the parameters
      3. Copy the exact enum values, description, and required status from the tool schema
    - If a calculation or transformation is needed (like counting, summing, or filtering), let the UI handle it.
    - For example, if you need to count items in an array, just return the array and let the UI count it.
    - Clearly separate each action step and provide a unique \`id\`.
    - Parameters can reference outputs of previous actions using the syntax \`"<action_id>.<output_field>"\`.
    - For array outputs, you can use array notation: \`"<action_id>[*].<output_field>"\` to reference each item in the array.
    - When an action needs to process each item in an array result from a previous step, set \`"map": true\` for that action.
    - Example mapping workflow:
      * Step 1: Gets a list of users (\`get_all_users\` returns array of user objects)
      * Step 2: Gets files for each user using \`"map": true\` and \`"userId": "get_all_users[*].email"\`

    If the user's message doesn't clearly request a workflow, always default to a general conversational response format.

    Always respond strictly with JSON as defined above.` +
        `Today is ${today}`;

    return system_prompt;
};


export const processChatRequest = async ({ inquiry, previous }: { inquiry: string, previous: any[] }) => {

    const aiBot = getAIBot()

    const context = trim_array(previous, 20);
    const system_prompt = getSystemPrompt();

    // Use split tool schemas to handle large schemas
    const toolsSchemaChunks = generateSplitToolSchemas(8000);

    let messages: any[] = [
        { role: 'system', content: system_prompt }
    ];

    // Add tool schema chunks as separate system messages
    toolsSchemaChunks.forEach((chunk, index) => {
        const chunkContent = index === 0
            ? `Available backend functions:\n${JSON.stringify(chunk, null, 2)}`
            : `Additional backend functions (part ${index + 1}):\n${JSON.stringify(chunk, null, 2)}`;

        messages.push({ role: "system", content: chunkContent });
    });

    console.log(`toolsSchema split into ${toolsSchemaChunks.length} chunks`);

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

    // Use split tool schemas to handle large schemas
    const toolsSchemaChunks = generateSplitToolSchemas(8000);

    let messages: any[] = [{ role: 'system', content: system_prompt }];

    // Add tool schema chunks as separate system messages
    toolsSchemaChunks.forEach((chunk, index) => {
        const chunkContent = index === 0
            ? `Available backend functions:\n${JSON.stringify(chunk, null, 2)}`
            : `Additional backend functions (part ${index + 1}):\n${JSON.stringify(chunk, null, 2)}`;

        messages.push({ role: "system", content: chunkContent });
    });

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