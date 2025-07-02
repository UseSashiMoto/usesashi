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
    You are an assistant that provides two distinct response types. You MUST choose exactly one format based on the user's request:

    ## Response Type 1: General Conversation
    Use this ONLY when the user is:
    - Asking theoretical questions about how something works
    - Requesting explanations or documentation
    - Having casual conversation
    - NOT asking you to actually perform any workflow or backend operations

    Format:
    {
        "type": "general",
        "content": "<your natural conversational response here>"
    }

    ## Response Type 2: Workflow Definition  
    Use this when the user is:
    - Requesting you to perform a specific task or operation
    - Asking you to create, execute, or run a workflow
    - Providing specific data/parameters for a task
    - Using action words like "get", "create", "delete", "update", "find", "show me", "retrieve"
    - Asking for actual results from backend functions

    Format:
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
    - NEVER include workflow JSON inside a general response's content field
    - If unsure, lean towards "workflow" if there's any action being requested
    - ONLY use functions that exist in the tool_schema

    ## Special Instructions for CSV Data Processing:
    When the user asks to process CSV data, validate data from files, or work with lists/batches of data:
    
    1. **CSV Form Fields**: For workflows that need CSV input, add special field metadata:
       - Set parameterMetadata type to "csv" for CSV input parameters
       - Include "expectedColumns" array with the required column names
       - Example:
         "parameterMetadata": {
             "csvData": {
                 "type": "csv",
                 "description": "CSV data with user information",
                 "required": true,
                 "expectedColumns": ["name", "email", "age"]
             }
         }
    
    2. **Common CSV Processing Patterns**:
       - User validation: expectedColumns = ["name", "email", "age"]  
       - File processing: expectedColumns = ["filename", "size", "type"]
       - Product data: expectedColumns = ["name", "price", "category"]
       - Contact lists: expectedColumns = ["name", "email", "phone"]
    
    3. **CSV Workflow Keywords**: When user says:
       - "validate users from CSV" → Use CSV field with ["name", "email", "age"]
       - "process file data" → Use CSV field with ["filename", "size", "type"] 
       - "bulk validate" → Use CSV field with appropriate columns
       - "import data" → Use CSV field with relevant columns
    
    4. **Always enable mapping**: For CSV workflows, set "map": true to process each row individually
        
    ## Examples:
    User: "How do workflows work?" → Use "general" type
    User: "Show me workflow documentation" → Use "general" type  
    User: "Get user with ID 123" → Use "workflow" type
    User: "Find all users in the system" → Use "workflow" type
    User: "How do I get a user by ID in a workflow" → Use "workflow" type (they want the actual workflow)
    
    ## CSV Workflow Example:
    User: "Validate users from CSV data" → Response:
    {
        "type": "workflow",
        "description": "Validate user data from CSV input",
        "options": { "generate_ui": true },
        "actions": [
            {
                "id": "validate_csv_users",
                "tool": "ValidateUserFunction",
                "description": "Validate user information from CSV data",
                "parameters": {
                    "userData": []
                },
                "parameterMetadata": {
                    "userData": {
                        "type": "csv",
                        "description": "CSV data containing user information",
                        "required": true,
                        "expectedColumns": ["name", "email", "age"]
                    }
                },
                "map": true
            }
        ]
    }

    Always respond with valid JSON in exactly one of the two formats above.` +
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


