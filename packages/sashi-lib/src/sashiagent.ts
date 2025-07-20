import { Agent, handoff, run } from '@openai/agents';
import { z } from 'zod';
import { generateSplitToolSchemas } from './ai-function-loader';

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
    }))
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


    return new Agent({
        name: 'Workflow Planner',
        instructions: `You are the Workflow Planner agent. Your job is to create workflow JSON objects that call backend functions.

## Available Functions
${toolSchemaString}

## Your Task
When handed off a user request, analyze it and create a JSON workflow object that accomplishes the user's goal.


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

## Important Rules for Workflow Embedding:
- ONLY use functions that exist in the tool_schema. NEVER make up functions.
- For parameters with "enum" fields, include enum values in parameterMetadata and only use values from the enum list
- Clean function names by removing "functions." prefix
- Use "userInput.<fieldname>" for parameters that need user input (like "userInput.userId", "userInput.type")
- Reference previous action outputs using "<action_id>.<output_field>" syntax
- For array outputs, use "<action_id>[*].<output_field>" notation
- Set "map": true when processing each item in an array from a previous step

## Action Guidelines
1. ONLY use functions that exist in the provided schema
2. Ensure all required parameters are provided
3. Use descriptive action IDs that relate to the function name
4. Make workflows as simple as possible - avoid unnecessary steps
5. Use literal values when you know them: "userId": 123
6. Use placeholders for user input: "name": "userInput.name"
7. Reference previous action outputs: "userId": "get_user.id"
8. For arrays, use: "items": "get_files[*].id"

## Important Notes
- Focus ONLY on the business logic and workflow actions
- Use userInput.* placeholders for any data the user needs to provide
- The UI Agent will handle creating the interface components
- Don't worry about UI - just create the workflow logic

`,
        tools: []
    });
};

// UI Agent - Specializes in generating UI components from workflows
const createUIAgent = () => {
    const toolSchemas = generateSplitToolSchemas(8000);
    const toolSchemaString = toolSchemas.map((chunk, index) => {
        return index === 0
            ? `Available backend functions:\n${JSON.stringify(chunk, null, 2)}`
            : `Additional backend functions (part ${index + 1}):\n${JSON.stringify(chunk, null, 2)}`;
    }).join('\n\n');


    return new Agent({
        name: 'UI Agent',
        instructions: `You are the UI Agent. Your job is to analyze workflows and generate appropriate UI components.

## Available Functions
${toolSchemaString}

## Your Task
When given a workflow, analyze it and add a ui property with input and output components.

## UI Component Generation Rules

### Step 1: Analyze Workflow Intent
Understand what the workflow is trying to accomplish:
- Is it sending emails? → Need email composition UI
- Is it creating records? → Need form fields for record data
- Is it searching/filtering? → Need search/filter inputs
- Is it displaying data? → Need output components

### Step 2: Generate Input Components
For each action, analyze its parameters and the function schema:

**For userInput.* parameters:**
- Look up the parameter in the function schema
- Use the schema's type, description, and enum values
- Create appropriate UI components:

**Common Patterns:**
- userInput.userId → text input for user ID
- userInput.email → email input field
- userInput.subject → text input for email subject
- userInput.message → textarea for email body
- userInput.content → textarea for long content
- userInput.type → select dropdown with enum values
- userInput.enabled → boolean switch
- userInput.count → number input

**UI Component Mapping:**
- string → "type": "string" (single-line input)
- text → "type": "text" (multi-line textarea)
- number → "type": "number"
- boolean → "type": "boolean"
- enum → "type": "enum" with enumValues array

**Special Cases:**
- Email workflows: Always include subject (text) and message (textarea)
- User selection: Include userId (text) or user search
- File operations: Include file path or upload fields
- Data creation: Include all required fields from schema

### Step 3: Generate Output Components
- Create one output component per action
- Use "component": "dataCard" for most cases
- Use "component": "table" if the action returns array data
- Use the action's id as the actionId

## Example: Email Workflow
For a workflow with get_user_by_id and send_email actions:
1. Input: userId (text), subject (text), message (textarea)
2. Output: dataCard for each action

Always call the enhance_workflow_with_ui tool with both the original workflow and the enhanced version.`,
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
const createSashiAgent = (workflowPlannerAgent: Agent, uiAgent: Agent, responseAgent: Agent) => {
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
1. Hand off to Workflow Planner to create the workflow logic
2. Hand off to Response Agent to generate final response with embedded workflow

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
    private uiAgent: Agent;
    private responseAgent: Agent;
    private mainAgent: Agent;

    constructor() {
        this.workflowPlannerAgent = createWorkflowPlannerAgent();
        this.uiAgent = createUIAgent();
        this.responseAgent = createResponseAgent();
        this.mainAgent = createSashiAgent(
            this.workflowPlannerAgent,
            this.uiAgent,
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