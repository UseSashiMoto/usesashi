import { Agent, handoff, run, tool } from '@openai/agents';
import { z } from 'zod';
import { generateSplitToolSchemas } from './ai-function-loader';
import { verifyWorkflow } from './utils/verifyWorkflow';

// Schema for basic workflow (without UI)
const WorkflowSchema = z.object({
    type: z.literal('workflow'),
    description: z.string(),
    actions: z.array(z.object({
        id: z.string(),
        tool: z.string(),
        description: z.string(),
        parameters: z.object({}).catchall(z.any())
    }))
});



// Schema for complete workflow with UI
const WorkflowWithUISchema = z.object({
    type: z.literal('workflow'),
    description: z.string(),
    actions: z.array(z.object({
        id: z.string(),
        tool: z.string(),
        description: z.string(),
    })),
    ui: z.object({
        inputComponents: z.array(z.object({
            key: z.string(),
            label: z.string(),
            type: z.enum(['string', 'number', 'boolean', 'enum', 'text']),
            required: z.boolean(),
            enumValues: z.array(z.string()).nullable().optional()
        })),
        outputComponents: z.array(z.object({
            actionId: z.string(),
            component: z.enum(['table', 'dataCard']),
            props: z.object({}).catchall(z.any()).nullable().optional()
        }))
    })
});

// Response schema
const SashiAgentResponseSchema = z.object({
    type: z.literal('general'),
    content: z.string()
});

export type SashiAgentResponse = z.infer<typeof SashiAgentResponseSchema>;
export type WorkflowWithUI = z.infer<typeof WorkflowWithUISchema>;

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
        execute: async ({ workflow }) => {
            const verification = verifyWorkflow(workflow);
            console.log('verification', verification);

            // Additional validation for UI components
            const uiValidation = {
                valid: true,
                errors: [] as string[]
            };

            // Collect all userInput.* parameters from actions
            const userInputParams = new Set<string>();
            if (workflow.actions) {
                for (const action of workflow.actions) {
                    if (action.parameters) {
                        for (const [key, value] of Object.entries(action.parameters)) {
                            if (typeof value === 'string' && value.startsWith('userInput.')) {
                                userInputParams.add(value);
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
For each userInput.* parameter in your workflow actions:
1. Create a matching inputComponent with key="userInput.<fieldname>"
2. Look up the parameter in the function schema to determine type and validation
3. Use appropriate UI component types:
   - string → single-line text input
   - text → multi-line textarea (for longer content like messages)
   - number → number input
   - boolean → switch/checkbox
   - enum → dropdown select with enumValues

### Output Components
1. Create one output component per action
2. Use "dataCard" for single object results
3. Use "table" for array results
4. Set actionId to match the action's id

## Important Rules:
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
const createSashiAgent = (workflowPlannerAgent: Agent, responseAgent: Agent) => {
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
            })
        ]
    });
};

export class SashiAgent {
    private workflowPlannerAgent: Agent;
    private responseAgent: Agent;
    private mainAgent: Agent;

    constructor() {
        this.workflowPlannerAgent = createWorkflowPlannerAgent();
        this.responseAgent = createResponseAgent();
        this.mainAgent = createSashiAgent(
            this.workflowPlannerAgent,
            this.responseAgent
        );
    }

    /**
     * Main entry point for processing user requests.
     * The SashiAgent will route to appropriate specialized agents.
     */
    async processRequest(inquiry: string, previous: any[] = []): Promise<SashiAgentResponse> {
        try {
            // Let the main SashiAgent handle routing via handoffs
            const result = await run(this.mainAgent, inquiry);

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