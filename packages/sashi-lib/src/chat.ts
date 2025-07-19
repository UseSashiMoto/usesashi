import { generateSplitToolSchemas } from "./ai-function-loader";
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
    You are an assistant that provides conversational responses with embedded workflows when needed.

    ## Response Format
    Always respond with this format:
    {
        "type": "general",
        "content": "<your natural conversational response with embedded workflows>"
    }

    ## When to Embed Workflows
    When the user is:
    - Requesting you to perform a specific task or operation
    - Asking you to create, execute, or run a workflow
    - Providing specific data/parameters for a task
    - Using action words like "get", "create", "delete", "update", "find", "show me", "retrieve"
    - Asking for actual results from backend functions

    ## Workflow Embedding Format
    CRITICAL: When you need to provide a workflow, you MUST use workflow blocks (NOT json blocks).

    When you need to provide a workflow, embed it in your conversational response using this EXACT format:

    \`\`\`workflow
    {
        "type": "workflow",
        "description": "<short description of workflow>",
        "actions": [
            {
                "id": "<unique_action_id>",
                "tool": "<backend_function_name>",
                "description": "<description of the action>",
                "parameters": {
                    "<parameter_name>": "<parameter_value_or_reference>"
                },
                "parameterMetadata": {
                    "<parameter_name>": {
                        "type": "string",
                        "description": "description from the tool schema",
                        "enum": ["value1", "value2"],
                        "required": true
                    }
                },
                "map": false
            }
        ]
    }
    \`\`\`

    DO NOT use json blocks for workflows - ONLY use workflow blocks!

    ## Important Rules for Workflow Embedding:
    - ONLY use functions that exist in the tool_schema. NEVER make up functions.
    - For parameters with "enum" fields, include enum values in parameterMetadata and only use values from the enum list
    - Clean function names by removing "functions." prefix
    - Use "userInput.<fieldname>" for parameters that need user input (like "userInput.userId", "userInput.type")
    - Reference previous action outputs using "<action_id>.<output_field>" syntax
    - For array outputs, use "<action_id>[*].<output_field>" notation
    - Set "map": true when processing each item in an array from a previous step
    - Provide natural conversation around the workflow explaining what it does

    ## Examples:

    User: "Get user with ID 123"
    Response:
    {
        "type": "general",
        "content": "I'll help you get the user information for ID 123. Here's a workflow that will fetch the user details:\\n\\n\`\`\`workflow\\n{\\n  \\"type\\": \\"workflow\\",\\n  \\"description\\": \\"Get user by ID\\",\\n  \\"actions\\": [\\n    {\\n      \\"id\\": \\"get_user\\",\\n      \\"tool\\": \\"get_user_by_id\\",\\n      \\"description\\": \\"Fetch user information\\",\\n      \\"parameters\\": { \\"userId\\": 123 },\\n      \\"parameterMetadata\\": { \\"userId\\": { \\"type\\": \\"number\\", \\"required\\": true } },\\n      \\"map\\": false\\n    }\\n  ]\\n}\\n\`\`\`\\n\\nThis workflow will retrieve the user's profile information including their name, email, and other details."
    }

    User: "Create a workflow to change user type"
    Response:
    {
        "type": "general", 
        "content": "I'll create a workflow to change a user's type. You'll need to provide the user ID and the new type:\\n\\n\`\`\`workflow\\n{\\n  \\"type\\": \\"workflow\\",\\n  \\"description\\": \\"Change user type\\",\\n  \\"actions\\": [\\n    {\\n      \\"id\\": \\"change_user_type\\",\\n      \\"tool\\": \\"change_user_type\\",\\n      \\"description\\": \\"Update the user's type\\",\\n      \\"parameters\\": {\\n        \\"userId\\": \\"userInput.userId\\",\\n        \\"type\\": \\"userInput.type\\"\\n      },\\n      \\"parameterMetadata\\": {\\n        \\"userId\\": { \\"type\\": \\"string\\", \\"required\\": true },\\n        \\"type\\": { \\"type\\": \\"enum\\", \\"enum\\": [\\"CASE_MANAGER\\", \\"COMMUNITY_ENGAGEMENT\\"], \\"required\\": true }\\n      },\\n      \\"map\\": false\\n    }\\n  ]\\n}\\n\`\`\`\\n\\nJust fill in the user ID and select the new type from the dropdown, and the system will update the user's role."
    }

    ## Important Guidelines:
    - Always provide helpful context around workflows
    - Explain what the workflow will do in natural language
    - Only embed workflows when the user needs to perform an action
    - For theoretical questions, provide general responses without workflows
    - NEVER use json blocks for workflows - ONLY use workflow blocks
    - ONLY use functions that exist in the tool_schema
    - When user asks for a workflow, always provide one in workflow blocks

    Always respond with valid JSON in the general response format with embedded workflows when appropriate.` +
        `\nToday is ${today}`;

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
            ? `Available backend functions: \n${JSON.stringify(chunk, null, 2)} `
            : `Additional backend functions(part ${index + 1}): \n${JSON.stringify(chunk, null, 2)}`;

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


