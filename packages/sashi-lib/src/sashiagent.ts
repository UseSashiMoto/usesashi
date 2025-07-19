import { Agent, handoff, run, tool } from '@openai/agents';
import { z } from 'zod';
import { generateSplitToolSchemas } from './ai-function-loader';
import { verifyWorkflow } from './utils/verifyWorkflow';

// Schema for workflow creation
const WorkflowSchema = z.object({
    type: z.literal('workflow'),
    description: z.string(),
    actions: z.array(z.object({
        id: z.string(),
        tool: z.string(),
        description: z.string(),
        parameters: z.record(z.any())
    }))
});

// Schema for UI enhancement
const WorkflowWithUISchema = z.object({
    type: z.literal('workflow'),
    description: z.string(),
    actions: z.array(z.object({
        id: z.string(),
        tool: z.string(),
        description: z.string(),
        parameters: z.record(z.any())
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
            props: z.record(z.any()).nullable().optional()
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

// Workflow Planner Agent - Creates workflows from user requests
const createWorkflowPlannerAgent = () => {
    const toolSchemas = generateSplitToolSchemas(8000);
    const toolSchemaString = toolSchemas.map((chunk, index) => {
        return index === 0
            ? `Available backend functions:\n${JSON.stringify(chunk, null, 2)}`
            : `Additional backend functions (part ${index + 1}):\n${JSON.stringify(chunk, null, 2)}`;
    }).join('\n\n');

    const createWorkflowTool = tool({
        name: 'create_workflow',
        description: 'Create a workflow JSON object based on user request',
        parameters: z.object({
            userRequest: z.string(),
            workflow: WorkflowSchema
        }),
        execute: async ({ userRequest, workflow }) => {
            // Validate the workflow
            const verification = verifyWorkflow(workflow);
            if (!verification.valid) {
                throw new Error(`Workflow validation failed: ${verification.errors.join(', ')}`);
            }
            return { userRequest, workflow };
        }
    });

    return new Agent({
        name: 'Workflow Planner',
        instructions: `You are the Workflow Planner agent. Your job is to create workflow JSON objects that call backend functions.

## Available Functions
${toolSchemaString}

## Your Task
When handed off a user request, analyze it and create a JSON workflow object that accomplishes the user's goal.

## Important Guidelines
1. ONLY use functions that exist in the provided schema
2. Ensure all required parameters are provided
3. Use descriptive action IDs that relate to the function name
4. Make workflows as simple as possible - avoid unnecessary steps
5. Use literal values when you know them: "userId": 123
6. Use placeholders for user input: "name": "userInput.name"
7. Reference previous action outputs: "userId": "get_user.id"
8. For arrays, use: "items": "get_files[*].id"

Always call the create_workflow tool with both the user request and the complete workflow object.`,
        tools: [createWorkflowTool]
    });
};

// UI Composer Agent - Enhances workflows with UI components
const createUIComposerAgent = () => {
    const toolSchemas = generateSplitToolSchemas(8000);
    const toolSchemaString = toolSchemas.map((chunk, index) => {
        return index === 0
            ? `Available backend functions:\n${JSON.stringify(chunk, null, 2)}`
            : `Additional backend functions (part ${index + 1}):\n${JSON.stringify(chunk, null, 2)}`;
    }).join('\n\n');

    const enhanceWorkflowTool = tool({
        name: 'enhance_workflow_with_ui',
        description: 'Enhance a workflow with UI components',
        parameters: z.object({
            originalWorkflow: WorkflowSchema,
            enhancedWorkflow: WorkflowWithUISchema
        }),
        execute: async ({ originalWorkflow, enhancedWorkflow }) => {
            return enhancedWorkflow;
        }
    });

    return new Agent({
        name: 'UI Composer',
        instructions: `You are the UI Composer agent. Your job is to enhance verified workflows with UI component definitions.

## Available Functions
${toolSchemaString}

## Your Task
When given a workflow, add a ui property that defines:
1. Input components needed for user data entry
2. Output components for displaying results

## Input Component Rules
- Scan all action parameters for userInput.* placeholders
- Map parameter types to UI components:
  - string -> "type": "string" (single-line input)
  - text -> "type": "text" (multi-line textarea)
  - number -> "type": "number"
  - boolean -> "type": "boolean"
  - enum -> "type": "enum" with enumValues array
- Use parameter metadata for labels and required status
- Default label to the field key if no description available

## Output Component Rules
- For each action, determine the best display component:
  - If return type suggests array data -> "component": "table"
  - Otherwise -> "component": "dataCard"
- Use the action's id as the actionId

Always call the enhance_workflow_with_ui tool with both the original workflow and the enhanced version.`,
        tools: [enhanceWorkflowTool]
    });
};

// Response Agent - Generates conversational responses with embedded workflows
const createResponseAgent = () => {
    const generateResponseTool = tool({
        name: 'generate_response',
        description: 'Generate a conversational response with optional embedded workflow',
        parameters: z.object({
            userRequest: z.string(),
            responseType: z.enum(['simple', 'workflow']),
            content: z.string(),
            workflow: WorkflowWithUISchema.nullable().optional()
        }),
        execute: async ({ userRequest, responseType, content, workflow }) => {
            if (responseType === 'workflow' && workflow) {
                const workflowBlock = `\n\n\`\`\`workflow\n${JSON.stringify(workflow, null, 2)}\n\`\`\``;
                return {
                    type: 'general',
                    content: content + workflowBlock
                };
            }
            return {
                type: 'general',
                content
            };
        }
    });

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
        tools: [generateResponseTool]
    });
};

// Main SashiAgent - Router that decides which agents to use
const createSashiAgent = (workflowPlannerAgent: Agent, uiComposerAgent: Agent, responseAgent: Agent) => {
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
1. Hand off to Workflow Planner to create the workflow
2. Hand off to UI Composer to enhance with UI components  
3. Hand off to Response Agent to generate final response with embedded workflow

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
            handoff(uiComposerAgent, {
                toolDescriptionOverride: 'Hand off to UI Composer to enhance a workflow with UI components after workflow creation'
            }),
            handoff(responseAgent, {
                toolDescriptionOverride: 'Hand off to Response Agent for informational responses, explanations, or when user wants to understand concepts'
            })
        ]
    });
};

export class SashiAgent {
    private workflowPlannerAgent: Agent;
    private uiComposerAgent: Agent;
    private responseAgent: Agent;
    private mainAgent: Agent;

    constructor() {
        this.workflowPlannerAgent = createWorkflowPlannerAgent();
        this.uiComposerAgent = createUIComposerAgent();
        this.responseAgent = createResponseAgent();
        this.mainAgent = createSashiAgent(
            this.workflowPlannerAgent,
            this.uiComposerAgent,
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