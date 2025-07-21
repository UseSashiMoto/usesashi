import { Agent, AgentInputItem, assistant, handoff, run, tool, user } from '@openai/agents';
import { z } from 'zod';
import { generateSplitToolSchemas } from './ai-function-loader';
import { WorkflowResponse } from './models/models';
import { verifyWorkflow } from './utils/verifyWorkflow';


// Response schema
const SashiAgentResponseSchema = z.object({
    type: z.literal('general'),
    content: z.string()
});

export type SashiAgentResponse = z.infer<typeof SashiAgentResponseSchema>;

// Workflow Planner Agent - Creates workflows (business logic only)
const createWorkflowPlannerAgent = () => {
    const toolSchemas = generateSplitToolSchemas(8000);
    const toolSchemaString = toolSchemas.map((chunk, index) => {
        return index === 0
            ? `Available backend functions:\n${JSON.stringify(chunk, null, 2)}`
            : `Additional backend functions (part ${index + 1}):\n${JSON.stringify(chunk, null, 2)}`;
    }).join('\n\n');

    const validateWorkflowTool = tool({
        name: 'validate_workflow',
        description: 'Validate a workflow JSON object to ensure it uses valid functions and parameters, and that UI components exist for userInput parameters',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {
                workflow: {
                    type: "object" as const,
                    properties: {
                        type: {
                            type: "string" as const,
                            enum: ["workflow"] as const
                        },
                        description: {
                            type: "string" as const
                        }
                    }
                }
            },
            required: ["workflow"],
            additionalProperties: true as const
        } as any,
        execute: async ({ workflow }: { workflow: WorkflowResponse }) => {
            const verification = verifyWorkflow(workflow);

            // Additional validation for UI components
            const uiValidation = {
                valid: true,
                errors: [] as string[]
            };

            // Collect BASE userInput.* parameters from actions (not array operations)
            const userInputParams = new Set<string>();
            if (workflow.actions) {
                for (const action of workflow.actions) {
                    if (action.parameters) {
                        for (const [key, value] of Object.entries(action.parameters)) {
                            if (typeof value === 'string' && value.startsWith('userInput.')) {
                                // Only collect base parameters, not array operations
                                if (value.includes('[*]')) {
                                    // Extract base parameter from array operation
                                    // e.g., "userInput.csvData[*].email" -> "userInput.csvData"
                                    const baseParam = value.split('[*]')[0];
                                    if (baseParam) {
                                        userInputParams.add(baseParam);
                                    }
                                } else {
                                    // Regular userInput parameter
                                    userInputParams.add(value);
                                }
                            }
                        }
                    }
                }
            }

            // Check if UI components exist for each userInput parameter
            if (userInputParams.size > 0) {
                if (!workflow.ui || !workflow.ui.inputComponents) {
                    uiValidation.valid = false;
                    uiValidation.errors.push('Workflow has userInput parameters but no UI inputComponents defined');
                } else {
                    const componentIds = new Set(workflow.ui.inputComponents.map((c: any) => c.key));
                    for (const param of userInputParams) {
                        if (!componentIds.has(param)) {
                            uiValidation.valid = false;
                            uiValidation.errors.push(`Missing UI component for parameter: ${param}`);
                        }
                    }


                }
            }

            return {
                valid: verification.valid && uiValidation.valid,
                errors: [...verification.errors, ...uiValidation.errors],
                workflow: workflow
            };
        }
    });

    return new Agent({
        name: 'Workflow Planner',
        instructions: `You are the Workflow Planner agent. Your job is to create complete workflow JSON objects that include both backend function calls AND UI components.

## Available Functions
${toolSchemaString}

## Your Task
When handed off a user request, analyze it and create a complete JSON workflow object that accomplishes the user's goal, including both the workflow actions and UI components.

## User Input Parameter Strategy
When creating workflows, you need to determine what information the user must provide:

**Use userInput.* for:**
- Information that cannot be derived from function calls
- Data that must come from the user (IDs, text content, preferences, etc.)
- Parameters that are the "starting point" of the workflow

**Use function outputs for:**
- Data that can be retrieved from previous function calls
- Information that exists in the system and can be fetched

**Examples:**
- "Send email to user 123" → Use literal "123", not userInput
- "Send email to a user" → Use "userInput.userId" because we don't know which user
- "Send custom message" → Use "userInput.message" for the message content
- "Get user email then send email" → Use "userInput.userId" for first function, then "get_user.email" for second

## Workflow Validation
IMPORTANT: Before finalizing any workflow, you MUST use the validate_workflow tool to verify that:
- All functions exist in the available backend functions
- All required parameters are provided
- Parameter types match the function schemas
- UI components exist for all userInput.* parameters
- The workflow structure is correct

If validation fails, fix the errors and validate again until the workflow is valid.

## Complete Workflow Format
You must create workflows with BOTH actions and UI components:

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
    ],
    "ui": {
        "inputComponents": [
            {
                "key": "userInput.<fieldname>",
                "label": "Human-readable label",
                "type": "string|number|boolean|enum|text",
                "required": true|false,
                "enumValues": ["option1", "option2"] // only for enum type
            }
        ],
        "outputComponents": [
            {
                "actionId": "<action_id>",
                "component": "dataCard|table",
                "props": {}
            }
        ]
    }
}
\`\`\`

## UI Component Generation Rules

### Input Components
For each BASE userInput.* parameter in your workflow actions:
1. **ONLY create UI components for base form fields** (e.g., userInput.csvData, userInput.subject)
2. **DO NOT create UI components for array operations** (e.g., userInput.csvData[*].email)
3. Array operations like userInput.csvData[*].email are resolved from the base CSV field
4. Look up the parameter in the function schema to determine type and validation
5. Use appropriate UI component types:
   - string → single-line text input
   - text → multi-line textarea (for longer content like messages)  
   - number → number input
   - boolean → switch/checkbox
   - enum → dropdown select with enumValues
   - csv → CSV upload field with expectedColumns

### Output Components
1. Create one output component per action
2. Use "dataCard" for single object results
3. Use "table" for array results
4. Set actionId to match the action's id

## CSV Data Processing:
**IMPORTANT**: You have full CSV processing capabilities! The UI handles CSV parsing, and you can use existing backend functions with the parsed data.

**How CSV Processing Works:**
1. UI parses CSV text into array of objects (frontend)
2. Backend functions receive the parsed array data (not raw CSV)
3. Use existing functions like 'filter', 'extract', 'split', 'join' and any other functions that accept arrays
4. For email workflows, use the bulk email functions designed for CSV processing

**When user asks to process CSV data, validate data from files, or work with lists/batches of data:**

1. **CSV Form Fields**: For workflows that need CSV input, add special field metadata:
   - Set parameterMetadata type to "csv" for CSV input parameters
   - Include "expectedColumns" array with the required column names
   - Example: Set parameterMetadata with type "csv" and expectedColumns array

2. **Common CSV Processing Patterns**:
   - User validation: expectedColumns = ["name", "email", "age"]  
   - File processing: expectedColumns = ["filename", "size", "type"]
   - Product data: expectedColumns = ["name", "price", "category"]
   - Contact lists: expectedColumns = ["name", "email", "phone"]

3. **CSV Workflow Structure with Mapping**:
   - For CSV data processing with individual row operations, use array operations: "userInput.csvData[*].fieldName"
   - The UI will parse CSV and replace these array operations with actual values before execution
   - Set "map": true when you want to process each CSV row individually 
   - Use existing functions that work with individual objects from CSV rows
   - Chain multiple actions to process, filter, or transform CSV data

**CSV Array Operations**: Use "userInput.csvData[*].fieldName" to access individual fields when mapping over CSV rows.

5. **CSV UI Components**:
   - Add CSV inputComponent with type: "csv"
   - Include expectedColumns in the component definition
   - Example: Create inputComponent with key "userInput.csvData", type "csv", and expectedColumns array

6. **CSV Workflow Keywords**: When user says:
   - "send emails from CSV" → Use "send_mock_email" with map: true and userInput.csvData[*].email
   - "validate users from CSV" → Use CSV field with ["name", "email", "age"] + validation functions
   - "process file data" → Use CSV field with ["filename", "size", "type"] + data processing functions
   - "bulk validate" → Use CSV field + filter/extract functions for validation
   - "import data" → Use CSV field + appropriate processing functions

7. **CSV Email Workflow Example**:
   - Use tool: "send_mock_email" (NOT "send_email")
   - Set email: "userInput.csvData[*].email", subject: "userInput.subject", message: "userInput.message"
   - Set map: true (process each CSV row individually)
   - UI components: ONLY create for userInput.csvData (CSV), userInput.subject (string), userInput.message (text)
   - DO NOT create UI component for userInput.csvData[*].email (this is resolved from CSV)

**CORRECT Example:**
inputComponents: [
  {"key": "userInput.csvData", "type": "csv", "expectedColumns": ["email"]},
  {"key": "userInput.subject", "type": "string"},
  {"key": "userInput.message", "type": "text"}
]

**WRONG Example (DO NOT DO THIS):**
inputComponents: [
  {"key": "userInput.csvData", "type": "csv"},
  {"key": "userInput.csvData[*].email", "type": "string"}, // ❌ WRONG! Do not create this
  {"key": "userInput.subject", "type": "string"}
]

8. **CSV General Processing Example**:
   - Use "userInput.csvData[*].field" as parameter value for individual field access
   - Set parameterMetadata type to "csv" with expectedColumns array
   - Add UI inputComponent with type "csv" and same expectedColumns
   - Use "map": true to process each CSV row individually

**Remember**: Use "userInput.csvData[*].fieldName" with "map": true to process CSV data row by row!

## Important Rules:
- NEVER put comments in the workflow JSON
- ONLY use functions that exist in the tool_schema
- userInput.* is a special namespace ONLY for form inputs
- Reference previous action outputs using "<action_id>.<output_field>"
- For array outputs, use "<action_id>[*].<output_field>"
- Every userInput.* parameter MUST have a matching UI inputComponent
- Input component IDs must exactly match the userInput.* parameter names
- ALWAYS validate workflows using the validate_workflow tool before providing them

`,
        tools: [validateWorkflowTool]
    });
};

// Response Agent - Generates conversational responses with embedded workflows
const createResponseAgent = () => {

    return new Agent({
        name: 'Response Agent',
        instructions: `You are the Response Agent. Your job is to generate helpful, natural responses based on the user's intent.

## Your Task
Create responses that match the user's intent:

**For Informational Requests:**
- Provide clear explanations and guidance
- Answer questions about concepts, processes, or capabilities
- Help users understand how things work
- Offer helpful context and examples

**For Actionable Requests (with workflow):**
- Explain what the workflow will accomplish
- Provide context about the process
- Guide users on next steps and expectations
- Make technical workflows understandable

## Response Guidelines
- Match the tone to the user's intent (informational vs actionable)
- Be conversational and helpful
- Provide appropriate level of detail
- Include relevant context and guidance
- For workflows, explain the value and next steps

Determine the appropriate response type based on whether workflow data is provided and generate content accordingly.`,
        tools: []
    });
};

// Main SashiAgent - Router that decides which agents to use
const createSashiAgent = (workflowPlannerAgent: Agent, responseAgent: Agent, refinerAgent: Agent) => {
    return new Agent({
        name: 'SashiAgent',
        instructions: `You are SashiAgent, the main conversational AI assistant that intelligently routes requests to specialized agents.

## Your Role
You are the entry point for all user requests. Your job is to understand the user's intent and route them to the appropriate specialized agents to fulfill their needs.

## Core Decision: Workflow vs Conversational Response

**Route to Workflow Creation** when the user's intent is to:
- Accomplish a specific task that requires backend operations
- Get actual data or results from the system
- Perform actions that would change or retrieve information
- Execute operations that need system interaction
- Work with concrete entities (users, files, data, records, etc.)

**Route to Conversational Response** when the user's intent is to:
- Understand concepts, explanations, or how things work
- Get general information or guidance
- Have casual conversation or ask questions
- Learn about capabilities without performing actions

## Intent Analysis Framework
Focus on the user's underlying goal, not specific words:

**Actionable Intent Indicators:**
- User wants to accomplish something specific
- Request involves concrete entities or data
- User expects to receive actual results or see changes
- Request implies system interaction or backend operations

**Informational Intent Indicators:**
- User wants to understand or learn something
- Request is about concepts, processes, or explanations
- User is exploring capabilities or asking "how" questions
- Request is conversational or exploratory in nature

## Routing Strategy

**For Actionable Requests:**
1. Hand off to Workflow Planner to create complete workflow with actions and UI components

**For Informational Requests:**
1. Hand off directly to Response Agent for conversational response

## Key Principles
- Focus on intent, not keywords
- Be confident in your routing decisions
- Trust the specialized agents to handle their domains
- Prioritize user experience through smooth handoffs
- When in doubt, consider if the user expects to see actual results or data

Analyze the user's request to understand their true intent and route accordingly.`,
        handoffs: [
            handoff(workflowPlannerAgent, {
                toolDescriptionOverride: 'Hand off to Workflow Planner when user wants to accomplish a specific task that requires backend operations or system interaction'
            }),
            handoff(responseAgent, {
                toolDescriptionOverride: 'Hand off to Response Agent for informational responses, explanations, or when user wants to understand concepts'
            }),
            handoff(refinerAgent, {
                toolDescriptionOverride: 'Hand off to Refiner Agent when user wants to modify or fix an existing workflow'
            })
        ]
    });
};

const createWorkflowRefinerAgent = () => {
    return new Agent({
        name: 'Workflow Refiner',
        instructions: `
        You are the Workflow Refiner.
        Given a workflow and a list of errors or user requests, fix or modify the workflow.
        - Keep existing valid actions when possible.
        - Fix invalid parameters, chaining, or missing UI components.
        - Apply user-requested changes (e.g., add steps, update values).
        Always return a complete, valid workflow JSON.
        `
    });
};

export class SashiAgent {
    private workflowPlannerAgent: Agent;
    private responseAgent: Agent;
    private mainAgent: Agent;
    private refinerAgent: Agent;

    constructor() {
        this.workflowPlannerAgent = createWorkflowPlannerAgent();
        this.responseAgent = createResponseAgent();
        this.refinerAgent = createWorkflowRefinerAgent();
        this.mainAgent = createSashiAgent(
            this.workflowPlannerAgent,
            this.responseAgent,
            this.refinerAgent
        );
    }

    /**
     * Main entry point for processing user requests.
     * The SashiAgent will route to appropriate specialized agents.
     */
    async processRequest(inquiry: string, previous: { role: string, content: string }[] = []): Promise<SashiAgentResponse> {
        try {

            const thread = previous.map((item) => {
                if (item.role === 'user') {
                    return user(item.content);
                }
                if (item.role === 'assistant') {
                    return assistant(item.content);
                }
                return null;
            }).filter((item) => item !== null) as AgentInputItem[];
            thread.push(user(inquiry));


            // Let the main SashiAgent handle routing via handoffs
            const result = await run(this.mainAgent, thread);

            // Extract the final response from the result
            const finalOutput = result.finalOutput;

            // Try to parse the result as a SashiAgentResponse
            try {
                if (typeof finalOutput === 'object' && finalOutput !== null) {
                    const parsed = finalOutput as any;
                    if (parsed.type === 'general' && typeof parsed.content === 'string') {
                        return parsed as SashiAgentResponse;
                    }
                }

                if (typeof finalOutput === 'string') {
                    return {
                        type: 'general',
                        content: finalOutput
                    };
                }
            } catch (e) {
                // Fall through to default handling
            }

            // Otherwise, wrap it in the expected format
            return {
                type: 'general',
                content: typeof finalOutput === 'string' ? finalOutput : JSON.stringify(finalOutput)
            };

        } catch (error) {
            console.error('SashiAgent error:', error);
            return {
                type: 'general',
                content: `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or rephrase your request.`
            };
        }
    }
}

// Export a singleton instance
let sashiAgent: SashiAgent | null = null;

export const getSashiAgent = (): SashiAgent => {
    if (!sashiAgent) {
        sashiAgent = new SashiAgent();
    }
    return sashiAgent;
}; 