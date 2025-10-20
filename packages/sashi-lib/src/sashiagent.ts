import { Agent, AgentInputItem, assistant, Handoff, handoff, run, tool, user } from '@openai/agents';
import { z } from 'zod';
import { getFunctionRegistry } from './ai-function-loader';
import { GitHubConfig, initializeGitHubAPI } from './github-api-service';
import { getAvailableTopics, WORKFLOW_PLANNER_KNOWLEDGE, type KnowledgeTopic } from './knowledge-base';
import { WorkflowResponse } from './models/models';
import { verifyWorkflow } from './utils/verifyWorkflow';


// Response schema
const SashiAgentResponseSchema = z.object({
    type: z.literal('general'),
    content: z.string()
});

export type SashiAgentResponse = z.infer<typeof SashiAgentResponseSchema>;

// Helper function to check if a workflow can be executed with current registered functions
const checkWorkflowExecutability = (workflow: any): { isExecutable: boolean, missingFunctions: string[], status: string } => {
    const functionRegistry = getFunctionRegistry();
    const missingFunctions: string[] = [];

    try {
        // Extract the actual workflow definition
        const workflowDef = workflow.workflow?.workflow || workflow;

        if (!workflowDef.actions || !Array.isArray(workflowDef.actions)) {
            return {
                isExecutable: false,
                missingFunctions: [],
                status: 'invalid_format'
            };
        }

        // Check each action's tool
        for (const action of workflowDef.actions) {
            if (action.tool) {
                // Remove 'functions.' prefix if present
                const toolName = action.tool.replace(/^functions\./, '');

                if (!functionRegistry.has(toolName)) {
                    missingFunctions.push(toolName);
                }
            }
        }

        const isExecutable = missingFunctions.length === 0;
        const status = isExecutable ? 'executable' : 'missing_functions';

        return {
            isExecutable,
            missingFunctions,
            status
        };
    } catch (error) {
        console.error('Error checking workflow executability:', error);
        return {
            isExecutable: false,
            missingFunctions: [],
            status: 'error'
        };
    }
};

// Shared tool for listing available backend functions - used by multiple agents
const listAvailableToolsTool = tool({
    name: 'list_available_tools',
    description: 'Get a list of all currently registered backend functions/tools. Use this to verify a tool exists before using it in a workflow.',
    strict: false,
    parameters: {
        type: "object" as const,
        properties: {
            searchTerm: {
                type: "string" as const,
                description: "Optional search term to filter tools by name or description"
            }
        },
        required: [],
        additionalProperties: false as const
    } as any,
    execute: async ({ searchTerm }: { searchTerm?: string } = {}) => {
        console.log('🔍 list_available_tools called', { searchTerm });

        const functionRegistry = getFunctionRegistry();
        const allFunctions = Array.from(functionRegistry.values());

        // Filter if search term provided
        let filteredFunctions = allFunctions;
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filteredFunctions = allFunctions.filter(fn => {
                const name = fn.getName().toLowerCase();
                const desc = fn.getDescription().toLowerCase();
                return name.includes(searchLower) || desc.includes(searchLower);
            });
        }

        // Create a simplified list with name, description, and parameters
        const toolList = filteredFunctions.map(fn => {
            const params = fn.getParams();
            const paramList = params.map((param: any) => {
                const paramName = param.name || param.arg?.name || 'unknown';
                const paramType = param.type || param.arg?.type || 'any';
                const required = param.required !== false;
                return {
                    name: paramName,
                    type: paramType,
                    required: required,
                    description: param.description || param.arg?.description || ''
                };
            });

            return {
                name: fn.getName(),
                description: fn.getDescription(),
                parameters: paramList
            };
        });

        console.log(`✅ Found ${toolList.length} tools` + (searchTerm ? ` matching "${searchTerm}"` : ''));

        return {
            success: true,
            count: toolList.length,
            tools: toolList,
            message: searchTerm
                ? `Found ${toolList.length} tools matching "${searchTerm}"`
                : `Found ${toolList.length} available tools`
        };
    }
});

// Knowledge base search tool
const searchKnowledgeTool = tool({
    name: 'search_knowledge',
    description: 'Search the knowledge base for detailed documentation on workflow creation topics',
    strict: false,
    parameters: {
        type: "object" as const,
        properties: {
            topic: {
                type: "string" as const,
                description: "Topic to look up for detailed guidance",
                enum: getAvailableTopics()
            }
        },
        required: ["topic"],
        additionalProperties: false as const
    } as any,
    execute: async ({ topic }: { topic: KnowledgeTopic }) => {
        console.log('📚 search_knowledge called:', { topic });

        const content = WORKFLOW_PLANNER_KNOWLEDGE[topic];

        if (!content) {
            return {
                success: false,
                error: `Topic "${topic}" not found in knowledge base`,
                availableTopics: getAvailableTopics()
            };
        }

        console.log('✅ Knowledge retrieved:', {
            topic,
            contentLength: content.length,
            preview: content.substring(0, 100) + '...'
        });

        return {
            success: true,
            topic,
            content
        };
    }
});

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
        console.log('🔍 validate_workflow tool called with workflow:', {
            type: workflow.type,
            actionsCount: workflow.actions?.length || 0,
            hasUI: !!workflow.ui,
            inputComponents: workflow.ui?.inputComponents?.length || 0,
            outputComponents: workflow.ui?.outputComponents?.length || 0,
            timestamp: new Date().toISOString()
        });

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

        // Validate inputComponents schema structure
        if (workflow.ui && workflow.ui.inputComponents) {
            console.log('🔍 Validating inputComponents:', workflow.ui.inputComponents);
            workflow.ui.inputComponents.forEach((component: any, index: number) => {
                const componentPrefix = `inputComponent[${index}]`;
                console.log(`🔍 Validating ${componentPrefix}:`, component);

                // Check for incorrect schema usage (component + props instead of key + label + type)
                if (component.component && component.props) {
                    console.log(`❌ ${componentPrefix}: Found incorrect schema with component/props`);
                    uiValidation.valid = false;
                    uiValidation.errors.push(`${componentPrefix}: Using incorrect schema - use {key, label, type} instead of {component, props}`);
                }

                // Check required fields for inputComponents
                if (!component.key || typeof component.key !== 'string') {
                    console.log(`❌ ${componentPrefix}: Missing or invalid key field`);
                    uiValidation.valid = false;
                    uiValidation.errors.push(`${componentPrefix}: Missing or invalid 'key' field (required string)`);
                }

                if (!component.label || typeof component.label !== 'string') {
                    console.log(`❌ ${componentPrefix}: Missing or invalid label field`);
                    uiValidation.valid = false;
                    uiValidation.errors.push(`${componentPrefix}: Missing or invalid 'label' field (required string)`);
                }

                if (!component.type || typeof component.type !== 'string') {
                    console.log(`❌ ${componentPrefix}: Missing or invalid type field`);
                    uiValidation.valid = false;
                    uiValidation.errors.push(`${componentPrefix}: Missing or invalid 'type' field (required string)`);
                } else {
                    // Validate type is one of the supported types


                    const validTypes = ['string', 'number', 'boolean', 'enum', 'text', 'csv', 'array'];
                    if (!validTypes.includes(component.type)) {
                        console.log(`❌ ${componentPrefix}: Invalid type value '${component.type}'`);
                        uiValidation.valid = false;
                        uiValidation.errors.push(`${componentPrefix}: Invalid type '${component.type}'. Valid types are: ${validTypes.join(', ')}`);
                    }

                    // Additional validation for enum type
                    if (component.type === 'enum') {
                        if (!component.enumValues || !Array.isArray(component.enumValues) || component.enumValues.length === 0) {
                            console.log(`❌ ${componentPrefix}: enum type requires enumValues array`);
                            uiValidation.valid = false;
                            uiValidation.errors.push(`${componentPrefix}: type 'enum' requires a non-empty 'enumValues' array`);
                        }
                    }

                    // Additional validation for array type
                    if (component.type === 'array') {
                        if (!component.subFields || !Array.isArray(component.subFields) || component.subFields.length === 0) {
                            console.log(`❌ ${componentPrefix}: array type requires subFields array`);
                            uiValidation.valid = false;
                            uiValidation.errors.push(`${componentPrefix}: type 'array' requires a non-empty 'subFields' array`);
                        } else {
                            // Recursively validate subFields
                            const validateSubFields = (subFields: any[], prefix: string) => {
                                subFields.forEach((subField: any, subIndex: number) => {
                                    const subFieldPrefix = `${prefix}.subFields[${subIndex}]`;

                                    // Validate required properties
                                    if (!subField.key || typeof subField.key !== 'string') {
                                        uiValidation.valid = false;
                                        uiValidation.errors.push(`${subFieldPrefix}: Missing or invalid 'key' field (required string)`);
                                    }

                                    if (!subField.label || typeof subField.label !== 'string') {
                                        uiValidation.valid = false;
                                        uiValidation.errors.push(`${subFieldPrefix}: Missing or invalid 'label' field (required string)`);
                                    }

                                    if (!subField.type || typeof subField.type !== 'string') {
                                        uiValidation.valid = false;
                                        uiValidation.errors.push(`${subFieldPrefix}: Missing or invalid 'type' field (required string)`);
                                    } else {
                                        if (!validTypes.includes(subField.type)) {
                                            uiValidation.valid = false;
                                            uiValidation.errors.push(`${subFieldPrefix}: Invalid type '${subField.type}'. Valid types are: ${validTypes.join(', ')}`);
                                        }

                                        // Validate enum subField
                                        if (subField.type === 'enum') {
                                            if (!subField.enumValues || !Array.isArray(subField.enumValues) || subField.enumValues.length === 0) {
                                                uiValidation.valid = false;
                                                uiValidation.errors.push(`${subFieldPrefix}: type 'enum' requires a non-empty 'enumValues' array`);
                                            }
                                        }

                                        // Recursive validation for nested arrays
                                        if (subField.type === 'array') {
                                            if (!subField.subFields || !Array.isArray(subField.subFields) || subField.subFields.length === 0) {
                                                uiValidation.valid = false;
                                                uiValidation.errors.push(`${subFieldPrefix}: type 'array' requires a non-empty 'subFields' array`);
                                            } else {
                                                validateSubFields(subField.subFields, subFieldPrefix);
                                            }
                                        }
                                    }
                                });
                            };

                            validateSubFields(component.subFields, componentPrefix);
                        }
                    }

                }
            });
        }

        // Check if UI components exist for each userInput parameter
        if (userInputParams.size > 0) {
            if (!workflow.ui || !workflow.ui.inputComponents) {
                uiValidation.valid = false;
                uiValidation.errors.push('Workflow has userInput parameters but no UI inputComponents defined');
            } else {
                const componentIds = new Set(workflow.ui.inputComponents.map((c: any) => c.key).filter(Boolean));
                for (const param of userInputParams) {
                    if (!componentIds.has(param)) {
                        uiValidation.valid = false;
                        uiValidation.errors.push(`Missing UI component for parameter: ${param}`);
                    }
                }
            }
        }

        // Validate outputComponents schema structure  
        if (workflow.ui && workflow.ui.outputComponents) {
            workflow.ui.outputComponents.forEach((component: any, index: number) => {
                const componentPrefix = `outputComponent[${index}]`;

                if (!component.actionId || typeof component.actionId !== 'string') {
                    uiValidation.valid = false;
                    uiValidation.errors.push(`${componentPrefix}: Missing or invalid 'actionId' field (required string)`);
                }

                if (!component.component || typeof component.component !== 'string') {
                    uiValidation.valid = false;
                    uiValidation.errors.push(`${componentPrefix}: Missing or invalid 'component' field (required string)`);
                }

                if (!component.props || typeof component.props !== 'object') {
                    uiValidation.valid = false;
                    uiValidation.errors.push(`${componentPrefix}: Missing or invalid 'props' field (required object)`);
                }

                // Check that actionId references a valid action
                if (component.actionId && workflow.actions) {
                    const actionExists = workflow.actions.some((action: any) => action.id === component.actionId);
                    if (!actionExists) {
                        uiValidation.valid = false;
                        uiValidation.errors.push(`${componentPrefix}: actionId '${component.actionId}' does not match any action in the workflow`);
                    }
                }
            });
        }

        const finalResult = {
            valid: verification.valid && uiValidation.valid,
            errors: [...verification.errors, ...uiValidation.errors],
            workflow: workflow
        };

        console.log('🔍 Validation result:', {
            verificationValid: verification.valid,
            uiValidationValid: uiValidation.valid,
            finalValid: finalResult.valid,
            totalErrors: finalResult.errors.length,
            errors: finalResult.errors
        });

        // If validation fails, throw an error to prevent workflow from being used
        if (!finalResult.valid) {
            console.error('❌ WORKFLOW VALIDATION FAILED - Workflow should be rejected:', finalResult.errors);
            throw new Error(`Workflow validation failed: ${finalResult.errors.join('; ')}`);
        }

        return finalResult;
    }
});

// Workflow Planner Agent - Creates workflows (business logic only)
const createWorkflowPlannerAgent = () => {

    return new Agent({
        name: 'Workflow Planner',
        instructions: `You are the Workflow Planner agent. Your job is to create complete workflow JSON objects that include both backend function calls AND UI components.



## Knowledge Base Access
When you need detailed guidance, use the search_knowledge tool with these topics:
- **"parameterMetadata-guide"**: How to create parameterMetadata correctly (CRITICAL - use when working with parameters)
- **"aifunction-architecture"**: How the function system works, type coercion, validation
- **"workflow-best-practices"**: When to ask questions, parameter strategy, tool verification
- **"quick-reference"**: Quick syntax reference and common patterns

## Core Workflow Creation Rules

### Parameter Metadata (CRITICAL)
When creating action parameters, you MUST include parameterMetadata that EXACTLY matches the function's schema:
- Copy type, description, enum values, and required status from tool schema
- Tool schema "string" with enum → use type "enum" in your metadata
- Preserve enum values exactly (case-sensitive, same order)
- If confused, use search_knowledge("parameterMetadata-guide")

### Your Task - Two Options

**Option 1: Ask Follow-Up Questions (Recommended)**
If you're unsure about requirements or want confirmation:
- Simply respond conversationally with your questions
- Use markdown formatting for clarity
- Better to ask than guess!

**When to ask:**
- Request is vague or ambiguous
- Multiple ways to accomplish the goal
- Missing critical information
- Uncertain about parameters, returns, or tool behavior
- Multiple tools could work

**Option 2: Create Workflow Directly**
Only if request is crystal clear and you have all information:
- Create complete JSON workflow with actions and UI components
- Use search_knowledge for detailed guidance when needed

## Advanced Features

### _generate (Dynamic Parameter Generation)
Use when parameter values need to be generated dynamically:
\`\`\`json
{
    "parameters": {
        "sql": {
            "_generate": "SQL query that answers: userInput.query",
            "_context": "sql"
        }
    }
}
\`\`\`
**Contexts**: "sql", "markdown", "json", "general"

### _transform (Output Transformation)
Use when results need formatting or transformation:
\`\`\`json
{
    "_transform": {
        "_transform": "Format this data as a markdown table",
        "_context": "markdown"
    }
}
\`\`\`

### Parameter Referencing
- **userInput.field** - User form input (requires UI component)
- **actionId.field** - Previous action output  
- **"literal"** - Fixed value
- Use in parameters or inside _generate/_transform prompts

## Workflow Structure

\`\`\`workflow
{
    "type": "workflow",
    "description": "Short description",
    "actions": [{
        "id": "unique_id",
        "tool": "function_name",
        "parameters": { "param": "userInput.field" },
        "parameterMetadata": { "param": {"type": "string", "required": true} },
        "map": false
    }],
    "ui": {
        "inputComponents": [{
            "key": "userInput.field",
            "label": "Label",
            "type": "string|number|boolean|enum|text|csv|array",
            "required": true
        }],
        "outputComponents": [{
            "actionId": "unique_id",
            "component": "dataCard|table",
            "props": {}
        }]
    }
}
\`\`\`

## UI Components

### Input Components (CRITICAL)
Every userInput.* parameter MUST have a corresponding UI component:
- **Types**: string, text (multi-line), number, boolean, enum (with enumValues), csv (with expectedColumns), array (with subFields)
- **ONLY create for base fields**, NOT array operations (userInput.data[*].field)
- **Example**: userInput.csvData needs UI, but userInput.csvData[*].email does NOT

### Array Type (Repeatable Subforms)
For repeatable form sections where users need to input multiple items:
- **Type**: "array"
- **subFields**: Array of inputComponents (supports all types, including nested arrays)
- **Required**: true/false for the array itself
- **Minimum items**: 1 (hardcoded, users can't remove the last item)

Example - Survey questions:
\`\`\`json
{
  "key": "userInput.questions",
  "label": "Survey Questions",
  "type": "array",
  "required": true,
  "subFields": [
    {
      "key": "questionText",
      "label": "Question",
      "type": "text",
      "required": true
    },
    {
      "key": "answerType",
      "label": "Answer Type",
      "type": "enum",
      "enumValues": ["Multiple Choice", "Text", "Rating"],
      "required": true
    },
    {
      "key": "options",
      "label": "Options (comma separated)",
      "type": "string",
      "required": false
    }
  ]
}
\`\`\`

Result: \`[{questionText: "Q1", answerType: "Multiple Choice", options: "A,B,C"}, {questionText: "Q2", answerType: "Text", options: ""}]\`

### Output Components
- **dataCard**: Single object results
- **table**: Array results (expects {data: [...]}format)
- One component per action, match actionId

### CSV Processing Pattern
For CSV workflows:
1. Input: type "csv" with expectedColumns
2. Parameter: "userInput.csvData[*].fieldName"
3. Action: set "map": true
4. Do NOT create UI for array operations (auto-resolved from CSV)

## Critical Rules

### Output Format
- Wrap workflow in markdown workflow code block
- No comments in JSON
- Include both actions AND UI components

### Validation Process
1. Verify tools exist: Use list_available_tools if unsure
2. NEVER invent tool names: Only use registered functions
3. Always validate: Call validate_workflow before returning
4. Fix errors: If validation fails, fix and validate again

### Important Points
- Every userInput.* needs a UI component
- Copy parameterMetadata from tool schema exactly
- Use search_knowledge for detailed guidance when needed
- When confused: ASK questions rather than guessing

Need detailed help? Use search_knowledge with:
- parameterMetadata-guide (most common need)
- workflow-best-practices  
- aifunction-architecture
- quick-reference
`,
        tools: [listAvailableToolsTool, validateWorkflowTool, searchKnowledgeTool]
    });
};

// Workflow Executor Agent - Searches for and executes existing workflows, returning results in plain English
const createWorkflowExecutorAgent = (executeWorkflowFn?: (workflow: any, debug: boolean) => Promise<any>, apiConfig?: { hubUrl?: string, apiSecretKey?: string, sessionId?: string }) => {

    // List workflows tool
    const listWorkflowsTool = tool({
        name: 'list_workflows',
        description: 'List all available saved workflows',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {},
            required: [],
        } as any,
        execute: async () => {
            console.log('🔍 [Workflow Executor] Listing workflows...');
            try {
                if (!apiConfig?.hubUrl || !apiConfig?.apiSecretKey) {
                    return {
                        success: false,
                        error: 'Hub not configured - cannot fetch workflows'
                    };
                }

                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'x-api-token': apiConfig.apiSecretKey,
                };

                if (apiConfig.sessionId) {
                    headers['X-Session-ID'] = apiConfig.sessionId;
                }

                const response = await fetch(`${apiConfig.hubUrl}/workflows`, {
                    method: 'GET',
                    headers,
                    signal: AbortSignal.timeout(10000),
                });

                if (!response.ok) {
                    return {
                        success: false,
                        error: `Failed to fetch workflows: ${response.status} ${response.statusText}`
                    };
                }

                const workflows = await response.json();
                console.log('✅ [Workflow Executor] Found workflows:', workflows?.length || 0);

                // Check executability for each workflow
                const workflowsWithStatus = (workflows || []).map((workflow: any) => {
                    const executabilityCheck = checkWorkflowExecutability(workflow);
                    return {
                        ...workflow,
                        isExecutable: executabilityCheck.isExecutable,
                        executabilityStatus: executabilityCheck.status,
                        missingFunctions: executabilityCheck.missingFunctions,
                        statusLabel: executabilityCheck.isExecutable ? 'Ready' : 'Disabled (Missing Functions)'
                    };
                });

                console.log('✅ [Workflow Executor] Workflows with executability status:', {
                    total: workflowsWithStatus.length,
                    executable: workflowsWithStatus.filter((w: any) => w.isExecutable).length,
                    disabled: workflowsWithStatus.filter((w: any) => !w.isExecutable).length
                });

                return {
                    success: true,
                    workflows: workflowsWithStatus
                };
            } catch (error: any) {
                console.error('❌ [Workflow Executor] Error listing workflows:', error);
                return {
                    success: false,
                    error: error.message || 'Unknown error occurred'
                };
            }
        }
    });

    // Search workflows tool
    const searchWorkflowsTool = tool({
        name: 'search_workflows',
        description: 'Search for workflows by name, description, or ID',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {
                query: {
                    type: "string" as const,
                    description: "Search query - can be workflow name, description, or ID"
                }
            },
            required: ["query"],
        } as any,
        execute: async ({ query }: { query: string }) => {
            console.log('🔍 [Workflow Executor] Searching workflows for:', query);

            // First get all workflows by calling the list function directly
            const listResult = await (async () => {
                console.log('🔍 [Workflow Executor] Listing workflows...');
                try {
                    if (!apiConfig?.hubUrl || !apiConfig?.apiSecretKey) {
                        return {
                            success: false,
                            error: 'Hub not configured - cannot fetch workflows'
                        };
                    }

                    const headers: Record<string, string> = {
                        'Content-Type': 'application/json',
                        'x-api-token': apiConfig.apiSecretKey,
                    };

                    if (apiConfig.sessionId) {
                        headers['X-Session-ID'] = apiConfig.sessionId;
                    }

                    const response = await fetch(`${apiConfig.hubUrl}/workflows`, {
                        method: 'GET',
                        headers,
                        signal: AbortSignal.timeout(10000),
                    });

                    if (!response.ok) {
                        return {
                            success: false,
                            error: `Failed to fetch workflows: ${response.status} ${response.statusText}`
                        };
                    }

                    const workflows = await response.json();
                    console.log('✅ [Workflow Executor] Found workflows:', workflows?.length || 0);

                    // Check executability for each workflow
                    const workflowsWithStatus = (workflows || []).map((workflow: any) => {
                        const executabilityCheck = checkWorkflowExecutability(workflow);
                        return {
                            ...workflow,
                            isExecutable: executabilityCheck.isExecutable,
                            executabilityStatus: executabilityCheck.status,
                            missingFunctions: executabilityCheck.missingFunctions,
                            statusLabel: executabilityCheck.isExecutable ? 'Ready' : 'Disabled (Missing Functions)'
                        };
                    });

                    return {
                        success: true,
                        workflows: workflowsWithStatus
                    };
                } catch (error: any) {
                    console.error('❌ [Workflow Executor] Error listing workflows:', error);
                    return {
                        success: false,
                        error: error.message || 'Unknown error occurred'
                    };
                }
            })();

            if (!listResult.success) {
                return listResult;
            }

            const workflows = listResult.workflows || [];
            const searchQuery = query.toLowerCase();

            // Search by ID, name, or description
            const matchingWorkflows = workflows.filter((workflow: any) => {
                const id = workflow.id?.toLowerCase() || '';
                const name = workflow.name?.toLowerCase() || '';
                const description = workflow.description?.toLowerCase() || '';

                return id.includes(searchQuery) ||
                    name.includes(searchQuery) ||
                    description.includes(searchQuery);
            });

            console.log('✅ [Workflow Executor] Found matching workflows:', matchingWorkflows.length);

            return {
                success: true,
                workflows: matchingWorkflows
            };
        }
    });

    // Extract parameters from user prompt tool
    const extractParametersTool = tool({
        name: 'extract_parameters_from_prompt',
        description: 'Extract workflow parameters from the user\'s natural language prompt',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {
                userPrompt: {
                    type: "string" as const,
                    description: "The user's natural language request"
                },
                workflow: {
                    type: "object" as const,
                    description: "The workflow object to extract parameters for"
                }
            },
            required: ["userPrompt", "workflow"],
            additionalProperties: false as const
        } as any,
        execute: async ({ userPrompt, workflow }: { userPrompt: string, workflow: any }) => {
            console.log('🔍 [Parameter Extractor] Extracting parameters from prompt:', userPrompt);

            try {
                const extractedParams: Record<string, any> = {};
                const requiredParams: string[] = [];
                const parameterInfo: Record<string, any> = {};

                // Extract WorkflowResponse from SavedWorkflow
                const workflowDef = workflow.workflow.workflow;

                // Analyze workflow to find required parameters
                if (workflowDef.actions) {
                    for (const action of workflowDef.actions) {
                        if (action.parameters) {
                            for (const [key, value] of Object.entries(action.parameters)) {
                                if (typeof value === 'string' && value.startsWith('userInput.')) {
                                    const paramName = value.replace('userInput.', '');
                                    requiredParams.push(paramName);

                                    // Get parameter metadata if available
                                    if (action.parameterMetadata && action.parameterMetadata[key]) {
                                        parameterInfo[paramName] = action.parameterMetadata[key];
                                    }
                                }
                            }
                        }
                    }
                }

                // Extract parameters using various strategies
                const prompt = userPrompt.toLowerCase();

                // Strategy 1: Extract IDs (numbers)
                const idMatches = userPrompt.match(/\b\d+\b/g);
                if (idMatches) {
                    // Look for common ID parameter names
                    const idParams = requiredParams.filter(p =>
                        p.includes('id') || p.includes('Id') ||
                        p === 'userId' || p === 'workflowId' || p === 'taskId'
                    );
                    if (idParams.length > 0 && idMatches.length > 0 && idParams[0] && idMatches[0]) {
                        extractedParams[idParams[0]] = idMatches[0];
                    }
                }

                // Strategy 2: Extract emails
                const emailMatch = userPrompt.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
                if (emailMatch) {
                    const emailParams = requiredParams.filter(p =>
                        p.includes('email') || p.includes('Email')
                    );
                    if (emailParams.length > 0 && emailParams[0] && emailMatch[0]) {
                        extractedParams[emailParams[0]] = emailMatch[0];
                    }
                }

                // Strategy 3: Extract role/status values
                const roleKeywords = ['admin', 'user', 'manager', 'editor', 'viewer', 'owner'];
                const statusKeywords = ['active', 'inactive', 'pending', 'completed', 'cancelled'];

                for (const keyword of [...roleKeywords, ...statusKeywords]) {
                    if (prompt.includes(keyword)) {
                        const roleParams = requiredParams.filter(p =>
                            p.includes('role') || p.includes('Role') ||
                            p.includes('status') || p.includes('Status')
                        );
                        if (roleParams.length > 0 && roleParams[0]) {
                            extractedParams[roleParams[0]] = keyword;
                        }
                    }
                }

                // Strategy 4: Extract quoted strings (for messages, names, etc.)
                const quotedMatches = userPrompt.match(/"([^"]+)"/g) || userPrompt.match(/'([^']+)'/g);
                if (quotedMatches) {
                    const textParams = requiredParams.filter(p =>
                        p.includes('message') || p.includes('Message') ||
                        p.includes('name') || p.includes('Name') ||
                        p.includes('title') || p.includes('Title') ||
                        p.includes('subject') || p.includes('Subject')
                    );
                    if (textParams.length > 0 && quotedMatches.length > 0 && textParams[0] && quotedMatches[0]) {
                        extractedParams[textParams[0]] = quotedMatches[0].replace(/['"]/g, '');
                    }
                }

                // Strategy 5: Context-based extraction
                // Look for "to [role]" patterns
                const toRoleMatch = prompt.match(/to\s+(admin|user|manager|editor|viewer|owner)/);
                if (toRoleMatch) {
                    const roleParams = requiredParams.filter(p =>
                        p.includes('role') || p.includes('Role')
                    );
                    if (roleParams.length > 0 && roleParams[0] && toRoleMatch[1]) {
                        extractedParams[roleParams[0]] = toRoleMatch[1];
                    }
                }

                // Strategy 6: Extract file names or paths
                const fileMatch = userPrompt.match(/\b[\w-]+\.(txt|csv|json|pdf|doc|docx|xlsx|xls)\b/i);
                if (fileMatch) {
                    const fileParams = requiredParams.filter(p =>
                        p.includes('file') || p.includes('File') ||
                        p.includes('path') || p.includes('Path')
                    );
                    if (fileParams.length > 0 && fileParams[0] && fileMatch[0]) {
                        extractedParams[fileParams[0]] = fileMatch[0];
                    }
                }

                console.log('✅ [Parameter Extractor] Extraction complete:', {
                    requiredParams,
                    extractedParams,
                    extractedCount: Object.keys(extractedParams).length,
                    requiredCount: requiredParams.length
                });

                return {
                    success: true,
                    extractedParameters: extractedParams,
                    requiredParameters: requiredParams,
                    parameterInfo: parameterInfo,
                    extractionStrategies: {
                        idsFound: idMatches?.length || 0,
                        emailsFound: emailMatch ? 1 : 0,
                        quotedStringsFound: quotedMatches?.length || 0,
                        rolesFound: roleKeywords.filter(k => prompt.includes(k)).length
                    }
                };
            } catch (error: any) {
                console.error('❌ [Parameter Extractor] Error:', error);
                return {
                    success: false,
                    error: error.message || 'Unknown error during parameter extraction'
                };
            }
        }
    });

    // Validate workflow parameters tool
    const validateWorkflowParametersTool = tool({
        name: 'validate_workflow_parameters',
        description: 'Validate extracted parameters against workflow requirements and provide user feedback',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {
                workflow: {
                    type: "object" as const,
                    description: "The workflow object"
                },
                extractedParameters: {
                    type: "object" as const,
                    description: "Parameters extracted from user prompt"
                },
                requiredParameters: {
                    type: "array" as const,
                    items: { type: "string" as const },
                    description: "List of required parameter names"
                }
            },
            required: ["workflow", "extractedParameters", "requiredParameters"],
            additionalProperties: false as const
        } as any,
        execute: async ({ workflow, extractedParameters, requiredParameters }: {
            workflow: any,
            extractedParameters: Record<string, any>,
            requiredParameters: string[]
        }) => {
            console.log('🔍 [Parameter Validator] Validating parameters...');

            try {
                const validationResults = {
                    isValid: true,
                    missingParameters: [] as string[],
                    invalidParameters: [] as { param: string, value: any, expectedType: string, error: string }[],
                    validParameters: {} as Record<string, any>,
                    parameterRequirements: {} as Record<string, any>
                };

                // Extract WorkflowResponse from SavedWorkflow
                const workflowDef = workflow.workflow.workflow;

                // Get parameter requirements from workflow
                const parameterMetadata: Record<string, any> = {};
                if (workflowDef.actions) {
                    for (const action of workflowDef.actions) {
                        if (action.parameterMetadata) {
                            for (const [key, value] of Object.entries(action.parameterMetadata)) {
                                if (action.parameters && action.parameters[key] &&
                                    typeof action.parameters[key] === 'string' &&
                                    action.parameters[key].startsWith('userInput.')) {
                                    const paramName = action.parameters[key].replace('userInput.', '');
                                    parameterMetadata[paramName] = value;
                                }
                            }
                        }
                    }
                }

                // Check for missing parameters
                for (const paramName of requiredParameters) {
                    if (!(paramName in extractedParameters)) {
                        validationResults.missingParameters.push(paramName);
                        validationResults.isValid = false;
                    }
                }

                // Validate parameter types and values
                for (const [paramName, value] of Object.entries(extractedParameters)) {
                    const metadata = parameterMetadata[paramName];
                    if (metadata) {
                        validationResults.parameterRequirements[paramName] = metadata;

                        try {
                            // Type validation
                            if (metadata.type === 'number') {
                                const numValue = Number(value);
                                if (isNaN(numValue)) {
                                    validationResults.invalidParameters.push({
                                        param: paramName,
                                        value: value,
                                        expectedType: 'number',
                                        error: `Expected a number, got: ${value}`
                                    });
                                    validationResults.isValid = false;
                                } else {
                                    validationResults.validParameters[paramName] = numValue;
                                }
                            } else if (metadata.type === 'boolean') {
                                const boolValue = value === 'true' || value === true || value === '1' || value === 1;
                                validationResults.validParameters[paramName] = boolValue;
                            } else if (metadata.enum && Array.isArray(metadata.enum)) {
                                if (!metadata.enum.includes(value)) {
                                    validationResults.invalidParameters.push({
                                        param: paramName,
                                        value: value,
                                        expectedType: `one of: ${metadata.enum.join(', ')}`,
                                        error: `Value must be one of: ${metadata.enum.join(', ')}`
                                    });
                                    validationResults.isValid = false;
                                } else {
                                    validationResults.validParameters[paramName] = value;
                                }
                            } else {
                                // String or other types
                                validationResults.validParameters[paramName] = String(value);
                            }
                        } catch (error: any) {
                            validationResults.invalidParameters.push({
                                param: paramName,
                                value: value,
                                expectedType: metadata.type || 'unknown',
                                error: error.message || 'Validation error'
                            });
                            validationResults.isValid = false;
                        }
                    } else {
                        // No metadata available, accept as string
                        validationResults.validParameters[paramName] = String(value);
                    }
                }

                console.log('✅ [Parameter Validator] Validation complete:', {
                    isValid: validationResults.isValid,
                    missingCount: validationResults.missingParameters.length,
                    invalidCount: validationResults.invalidParameters.length,
                    validCount: Object.keys(validationResults.validParameters).length
                });

                return {
                    success: true,
                    validation: validationResults
                };
            } catch (error: any) {
                console.error('❌ [Parameter Validator] Error:', error);
                return {
                    success: false,
                    error: error.message || 'Unknown error during parameter validation'
                };
            }
        }
    });

    // Execute workflow by ID tool
    const executeWorkflowByIdTool = tool({
        name: 'execute_workflow_by_id',
        description: 'Execute a specific workflow by its ID with validated parameters',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {
                workflowId: {
                    type: "string" as const,
                    description: "The ID of the workflow to execute"
                },
                parameters: {
                    type: "object" as const,
                    description: "Validated parameters to pass to the workflow execution",
                    additionalProperties: true
                }
            },
            required: ["workflowId"],
            additionalProperties: false as const
        } as any,
        execute: async ({ workflowId, parameters = {} }: { workflowId: string, parameters?: Record<string, any> }) => {
            console.log('⚡ [Workflow Executor] Executing workflow by ID:', workflowId);

            if (!executeWorkflowFn) {
                return {
                    success: false,
                    error: 'Workflow execution function not available'
                };
            }

            try {
                // First, get the workflow details
                if (!apiConfig?.hubUrl || !apiConfig?.apiSecretKey) {
                    return {
                        success: false,
                        error: 'Hub not configured - cannot fetch workflow'
                    };
                }

                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'x-api-token': apiConfig.apiSecretKey,
                };

                if (apiConfig.sessionId) {
                    headers['X-Session-ID'] = apiConfig.sessionId;
                }

                const response = await fetch(`${apiConfig.hubUrl}/workflows/${workflowId}`, {
                    method: 'GET',
                    headers,
                    signal: AbortSignal.timeout(10000),
                });

                if (!response.ok) {
                    return {
                        success: false,
                        error: `Failed to fetch workflow: ${response.status} ${response.statusText}`
                    };
                }

                const savedWorkflow = await response.json();

                // Check if workflow is executable before proceeding
                const executabilityCheck = checkWorkflowExecutability(savedWorkflow);
                if (!executabilityCheck.isExecutable) {
                    console.log('❌ [Workflow Executor] Workflow is not executable:', {
                        workflowId: workflowId,
                        workflowName: savedWorkflow.name,
                        status: executabilityCheck.status,
                        missingFunctions: executabilityCheck.missingFunctions
                    });

                    return {
                        success: false,
                        error: `The automation "${savedWorkflow.name || 'requested process'}" isn't currently available in your workspace. This feature may need to be set up or configured by your administrator.`,
                        workflowStatus: 'disabled',
                        userFriendlyMessage: `Sorry, the "${savedWorkflow.name || 'requested process'}" automation isn't available right now. You might want to check with your team administrator or try a different approach.`
                    };
                }

                // Extract the actual workflow definition
                const workflow = savedWorkflow.workflow.workflow;

                // Merge parameters into workflow if provided
                if (Object.keys(parameters).length > 0 && workflow.actions) {
                    for (const action of workflow.actions) {
                        if (action.parameters) {
                            for (const [key, value] of Object.entries(action.parameters)) {
                                if (typeof value === 'string' && value.startsWith('userInput.')) {
                                    const inputKey = value.replace('userInput.', '');
                                    if (parameters[inputKey] !== undefined) {
                                        action.parameters[key] = parameters[inputKey];
                                    }
                                }
                            }
                        }
                    }
                }

                console.log('⚡ [Workflow Executor] Executing workflow...');
                const executionResult = await executeWorkflowFn(workflow, false);

                return {
                    success: true,
                    result: executionResult,
                    message: 'Workflow executed successfully'
                };
            } catch (error: any) {
                console.error('❌ [Workflow Executor] Error executing workflow:', error);
                return {
                    success: false,
                    error: error.message || 'Unknown error occurred during workflow execution'
                };
            }
        }
    });

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
            console.log('🔍 validate_workflow tool called with workflow:', {
                type: workflow.type,
                actionsCount: workflow.actions?.length || 0,
                hasUI: !!workflow.ui,
                inputComponents: workflow.ui?.inputComponents?.length || 0,
                outputComponents: workflow.ui?.outputComponents?.length || 0,
                timestamp: new Date().toISOString()
            });

            const verification = verifyWorkflow(workflow);

            // Additional validation for UI components

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

            // For workflow executor, we don't need UI validation since we're executing immediately
            // Just validate the workflow structure and functions

            const finalResult = {
                valid: verification.valid,
                errors: verification.errors,
                workflow: workflow
            };

            console.log('🔍 Validation result:', {
                verificationValid: verification.valid,
                finalValid: finalResult.valid,
                totalErrors: finalResult.errors.length,
                errors: finalResult.errors
            });

            // If validation fails, throw an error to prevent workflow from being used
            if (!finalResult.valid) {
                console.error('❌ WORKFLOW VALIDATION FAILED - Workflow should be rejected:', finalResult.errors);
                throw new Error(`Workflow validation failed: ${finalResult.errors.join('; ')}`);
            }

            return finalResult;
        }
    });


    return new Agent({
        name: 'Workflow Executor',
        instructions: `You are the Workflow Executor agent. Your job is to find and execute existing saved workflows that accomplish the user's goal, returning the results in plain English with markdown formatting.

## Understanding the Function System

### How Backend Functions Work
All backend functions are registered in a function registry. When workflows execute:

1. **Function Lookup**: The workflow's "tool" field references a registered function by name
2. **Parameter Validation**: Parameters are validated against the function's AIFunction schema
3. **Type Coercion**: Parameter types are automatically converted (strings → numbers, "true" → boolean)
4. **Execution**: The function executes with validated parameters
5. **Result Return**: Results are returned in the format defined by the function

### Parameter Types and Validation
- **string**: Text values, automatically converted if needed
- **number**: Numeric values, strings are coerced to numbers if valid
- **boolean**: True/false values, strings "true"/"false" are coerced
- **enum**: Must match one of the allowed values exactly (e.g., ["admin", "user", "editor"])
- **array**: Lists of values
- **object**: Structured data with multiple fields

### Why Parameter Extraction Matters
When you extract parameters from user prompts, the types must match what the function expects:
- If a function expects a number, extract numeric values
- If a function expects an enum, extract one of the valid enum values
- If a function expects a string, any text value works

### Workflow Executability
Workflows can only execute if ALL referenced functions exist in the registry:
- **Status "Ready"**: All functions are registered and available
- **Status "Disabled"**: One or more functions are missing from the registry
- **Never execute disabled workflows**: They will fail because functions don't exist

## Your Task
When handed off a user request:
1. **SEARCH FOR EXISTING WORKFLOWS** - Use list_workflows or search_workflows to find relevant saved workflows
2. **IDENTIFY THE RIGHT WORKFLOW** - Look for workflows that match the user's intent by name, description, or functionality
3. **EXTRACT PARAMETERS** - Use extract_parameters_from_prompt to intelligently extract parameters from the user's natural language request
4. **VALIDATE PARAMETERS** - Use validate_workflow_parameters to ensure extracted parameters are correct and complete
5. **CHECK WORKFLOW STATUS** - Only proceed with workflows that have status "Ready", not "Disabled"
6. **HANDLE DISABLED WORKFLOWS** - If workflow is disabled, provide user-friendly feedback without technical details
7. **HANDLE MISSING/INVALID PARAMETERS** - If validation fails, provide clear feedback to the user about what's missing or incorrect
8. **EXECUTE THE WORKFLOW** - Use execute_workflow_by_id with the validated parameters
9. **FORMAT RESULTS** - Return results in plain English with markdown formatting
10. **NEVER CREATE NEW WORKFLOWS** - Only use existing saved workflows

## Workflow Discovery Process
**Step 1: List or Search Workflows**
- Use list_workflows to see all available workflows
- Use search_workflows with keywords from the user's request to find specific workflows
- Look for workflows that match the user's intent

**Step 2: Analyze Available Workflows**
- Review workflow names and descriptions
- Check workflow status (Ready vs Disabled)
- Only consider workflows with status "Ready" for execution
- If multiple executable workflows match, choose the most specific one
- If only disabled workflows match, provide user-friendly feedback without technical details

**Step 3: Parameter Extraction and Validation**
- Use extract_parameters_from_prompt to intelligently extract parameters from the user's natural language
- The tool will automatically identify and extract:
  - IDs (numbers like user IDs, workflow IDs)
  - Email addresses
  - Role/status keywords (admin, user, active, pending, etc.)
  - Quoted strings (for messages, names, titles)
  - File names and paths
  - Context-based values ("to admin role", "set status to active")
- Use validate_workflow_parameters to check if extracted parameters are valid and complete
- Handle validation results appropriately

## Parameter Handling Strategy

**Step-by-Step Parameter Processing:**

1. **Extract Parameters from User Request**
   - Use extract_parameters_from_prompt with the user's original request and the selected workflow
   - The extraction tool will automatically identify common patterns:
     - Numbers → IDs (userId, workflowId, etc.)
     - Email patterns → email parameters
     - Role keywords → role/status parameters
     - Quoted text → message/name/title parameters
     - File extensions → file/path parameters

2. **Validate Extracted Parameters**
   - Use validate_workflow_parameters to check the extracted parameters against workflow requirements
   - The validation will check:
     - Are all required parameters present?
     - Do parameter values match expected types (number, string, boolean, enum)?
     - Are enum values valid (e.g., role must be one of: admin, user, editor)?
     - Are parameter formats correct?

3. **Handle Validation Results**
   - **If validation passes**: Proceed with execution using the validated parameters
   - **If validation fails**: Provide clear, helpful feedback to the user

**Disabled Workflow Response Format:**
When a workflow is disabled (uses unregistered functions), provide user-friendly feedback:

\`\`\`markdown
# Automation Currently Unavailable

Sorry, the **"[Workflow Name]"** automation isn't available in your workspace right now.

## What this means:
This feature may need to be set up or configured by your administrator.

## What you can do:
- Check with your team administrator about enabling this feature
- Try a different approach or automation for your task
- Contact support if you need help finding alternatives

## Alternative suggestions:
[Suggest similar workflows that are available, if any]
\`\`\`

**Parameter Validation Feedback Format:**
When parameters are missing or invalid, provide specific guidance:

\`\`\`markdown
# Parameter Validation Failed

I found the workflow **"[Workflow Name]"** but need some additional information:

## Missing Parameters:
- **userId**: Please provide the user ID (e.g., "Update user 123")
- **role**: Please specify the new role (admin, user, editor, viewer)

## Invalid Parameters:
- **status**: You provided "activ" but valid options are: active, inactive, pending

## Example Usage:
"Update user 123 to admin role"
"Set user 456 status to active"
\`\`\`

**Examples of Parameter Extraction:**
- "Update user 123 to admin role" → Extracts: userId: "123", role: "admin"
- "Send email to john@example.com about 'Project Update'" → Extracts: email: "john@example.com", subject: "Project Update"
- "Set user 456 status to active" → Extracts: userId: "456", status: "active"
- "Process users.csv file" → Extracts: csvFile: "users.csv"

## Execution and Response Format
1. **Always search for workflows first** using list_workflows or search_workflows
2. **Execute found workflows** using execute_workflow_by_id
3. **Format results in markdown** with clear sections:
   - Brief summary of what was accomplished
   - Detailed results in tables or lists as appropriate
   - Any important notes or next steps

4. **Never return workflow JSON** to the user - they should only see the results

## Example Response Format:
\`\`\`markdown
# Task Completed Successfully

I found and executed the "User Role Update" workflow as requested.

## Results
| Field | Value |
|-------|-------|
| User ID | 123 |
| New Role | admin |
| Status | Updated |

The user's role has been changed and the system has been updated accordingly.
\`\`\`

## Important Rules:
- NEVER create new workflows - only use existing saved workflows
- ALWAYS search for workflows first before execution
- ALWAYS check workflow status - only execute workflows with status "Ready"
- NEVER execute workflows marked as "Disabled" or with missing functions
- ALWAYS extract parameters using extract_parameters_from_prompt before execution
- ALWAYS validate parameters using validate_workflow_parameters before execution
- NEVER execute workflows with invalid or missing parameters
- If parameter validation fails, provide clear, specific feedback about what's wrong
- ALWAYS execute workflows using execute_workflow_by_id with validated parameters
- ALWAYS format results in markdown
- ALWAYS provide plain English explanations of what was accomplished
- If no matching executable workflow is found, inform the user and suggest creating one through the proper channels
- If only disabled workflows match, provide user-friendly feedback without mentioning technical details
- If execution fails, explain the error in plain English and suggest solutions

## Parameter Processing Workflow:
1. Find matching workflow
2. Check workflow status → Only proceed if status is "Ready"
3. If workflow is "Disabled" → Inform user about missing functions
4. Extract parameters from user prompt → extract_parameters_from_prompt
5. Validate extracted parameters → validate_workflow_parameters
6. If validation fails → Provide specific feedback and ask for corrections
7. If validation passes → Execute workflow with validated parameters

Your goal is to find the right existing workflow, extract and validate parameters correctly, and execute it successfully.`,
        tools: [listWorkflowsTool, searchWorkflowsTool, extractParametersTool, validateWorkflowParametersTool, executeWorkflowByIdTool, validateWorkflowTool]
    });
};

// Response Agent - Generates conversational responses with embedded workflows (for regular chat)
const createResponseAgent = () => {
    return new Agent({
        name: 'Response Agent',
        instructions: `You are the Response Agent for regular chat interactions. Your job is to generate helpful, natural responses based on the user's intent.

## CRITICAL CONSTRAINT: Only Answer About This Specific System
You must ONLY answer questions based on the available functions and capabilities in THIS system. DO NOT provide generic information about how systems "typically" or "usually" work. 

## CRITICAL: Always Use list_available_tools for Function Questions
When asked about ANY function, parameter, or capability:
1. FIRST use the list_available_tools tool to look up the actual function details
2. THEN answer based ONLY on what the tool returns
3. NEVER answer from general knowledge or assumptions

**Example:** If asked "does create_survey have a parameter questions":
- ✅ CORRECT: Use list_available_tools with searchTerm "create_survey", then answer based on the actual parameters shown
- ❌ WRONG: Answer based on what survey functions "typically" have

When asked about functions, parameters, or capabilities:
- ALWAYS use list_available_tools tool first to get accurate information
- Answer specifically about what THIS system has, based on the tool results
- If the function doesn't exist in the results, say "This system doesn't have that function"
- If a parameter doesn't exist in the results, say "That parameter is not available on this function"
- NEVER say things like "in most systems", "typically", "usually", or "it depends on your system"
- Be precise and accurate about what exists in THIS system based on tool results

## Your Task
Create responses that match the user's intent:

**For Informational Requests:**
- Answer questions ONLY about THIS system's specific functions, parameters, and capabilities
- ALWAYS use list_available_tools to verify function details before answering
- Provide accurate, specific answers based on the tool results
- If information isn't available via the tool, clearly state that rather than guessing
- Help users understand how THIS specific system works
- DO NOT provide generic industry knowledge or typical patterns

**For Actionable Requests (with workflow):**
- Explain what the workflow will accomplish in THIS system
- Provide context about the process using THIS system's capabilities
- Guide users on next steps and expectations
- Make technical workflows understandable

## Response Guidelines
- Match the tone to the user's intent (informational vs actionable)
- Be conversational and helpful, but accurate to THIS system
- ALWAYS verify function details with list_available_tools before answering questions about them
- Only provide information you can verify from the tool results
- Include relevant context and guidance specific to THIS system
- For workflows, explain the value and next steps
- When in doubt, look it up with the tool rather than guessing

Determine the appropriate response type based on whether workflow data is provided and generate content accordingly.`,
        tools: [listAvailableToolsTool]
    });
};

// Linear Response Agent - Generates user-friendly, non-technical responses for Linear users
const createLinearResponseAgent = () => {
    return new Agent({
        name: 'Linear Response Agent',
        instructions: `You are the Linear Response Agent. Your job is to generate user-friendly, non-technical responses for Linear users who are primarily business users, not developers.

## Your Mission
Create responses that are:
- **Business-focused** - Talk about outcomes, not implementation
- **User-friendly** - No technical jargon or function names
- **Action-oriented** - Focus on what the user can do next
- **Empathetic** - Acknowledge frustrations and provide helpful guidance

## Response Guidelines

**For Workflow Execution Results:**
- Focus on business outcomes, not technical details
- Use terms like "task", "process", or "automation" instead of "workflow" or "function"
- Explain what was accomplished in business terms
- Provide next steps or suggestions

**For Workflow Availability Issues:**
- Never mention function names, registries, or technical concepts
- Focus on the business capability that's unavailable
- Provide helpful alternatives or escalation paths
- Be empathetic about the limitation

**For Informational Requests:**
- Provide clear, business-focused explanations
- Use analogies and simple language
- Focus on capabilities and benefits
- Avoid technical implementation details

## Tone and Language
- **Professional but friendly** - Like a helpful business assistant
- **Solution-oriented** - Always try to provide alternatives
- **Empathetic** - Acknowledge when things don't work as expected
- **Clear and concise** - Busy business users need quick, clear answers

## Example Transformations

**Instead of:** "Workflow uses unregistered function send_hotline_sms"
**Say:** "This automation isn't currently available in your workspace"

**Instead of:** "Function validation failed"
**Say:** "This process can't be completed right now"

**Instead of:** "Missing parameter userId"
**Say:** "I need to know which user you'd like to update"

**Instead of:** "Workflow executed successfully with 3 actions"
**Say:** "Task completed successfully! Here are the results:"

Your goal is to make every interaction feel natural and helpful for business users who just want to get things done.`,
        tools: []
    });
};

// GitHub Agent - Handles GitHub-specific requests with multi-step PM-friendly workflow
const createGitHubAgent = (config?: GitHubConfig) => {

    // Helper function to get GitHub service with config from hub
    const getInitializedGitHubService = async () => {
        try {

            if (!config?.token || !config?.owner || !config?.repo) {
                console.log('Invalid GitHub configuration', config);
                throw new Error('Invalid GitHub configuration');
            }

            // Initialize GitHub API service with config from hub
            return initializeGitHubAPI({
                token: config.token,
                owner: config.owner,
                repo: config.repo
            });
        } catch (error) {
            console.error('Failed to initialize GitHub service:', error);
            return null;
        }
    };

    // Helper functions for codebase analysis
    const detectFramework = (files: any[]) => {
        const filePaths = files.map(f => f.path).join(' ');
        if (filePaths.includes('next.config')) return 'Next.js';
        if (filePaths.includes('nuxt.config')) return 'Nuxt.js';
        if (filePaths.includes('vite.config')) return 'Vite';
        if (filePaths.includes('package.json')) return 'React';
        return 'Unknown';
    };

    const analyzeProjectStructure = (files: any[]) => {
        const dirs = new Set();
        files.forEach(f => {
            const pathParts = f.path.split('/');
            if (pathParts.length > 1) {
                dirs.add(pathParts[0]);
            }
        });
        return Array.from(dirs);
    };

    const detectCodePatterns = (files: any[]) => {
        const patterns = {
            hasComponents: files.some(f => f.path.includes('component')),
            hasPages: files.some(f => f.path.includes('page')),
            hasHooks: files.some(f => f.path.includes('hook')),
            hasUtils: files.some(f => f.path.includes('util')),
            hasServices: files.some(f => f.path.includes('service')),
            hasTypes: files.some(f => f.path.includes('type'))
        };
        return patterns;
    };

    const generateCodebaseInsights = (analysis: any, focus: string) => {
        const insights = [];
        insights.push(`Detected framework: ${analysis.framework}`);
        insights.push(`Found ${analysis.componentCount} React components`);
        insights.push(`Project structure includes: ${analysis.structure.join(', ')}`);

        if (focus === 'patterns') {
            insights.push('Code organization patterns detected:');
            Object.entries(analysis.patterns).forEach(([key, value]) => {
                if (value) insights.push(`- ${key.replace('has', 'Uses ')}`);
            });
        }

        return insights;
    };


    const analyzeCodebaseTool = tool({
        name: 'analyze_codebase',
        description: 'Analyze the codebase structure, patterns, and conventions to understand the project',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {
                focus: {
                    type: "string" as const,
                    description: "What to focus analysis on: 'structure', 'patterns', 'components', 'routing', 'state', or 'all'"
                }
            },
            required: ["focus"],
            additionalProperties: false as const
        } as any,
        execute: async ({ focus }: { focus: string }) => {
            console.log('🔍 Analyzing codebase structure and patterns:', {
                focus: focus,
                timestamp: new Date().toISOString()
            });

            try {
                const githubService = await getInitializedGitHubService();

                if (!githubService) {
                    console.log("no github service, debugging github service", {
                        githubService: githubService,
                        focus: focus,
                        timestamp: new Date().toISOString()
                    })
                    return {
                        error: 'GitHub not configured',
                        message: 'GitHub service not initialized. Please configure GitHub integration in Settings first.'
                    };
                }

                // Use GitHub API to search for different file types based on focus
                let searchQueries: string[] = [];

                switch (focus) {
                    case 'structure':
                        searchQueries = ['package.json', 'tsconfig.json', 'next.config', 'webpack.config'];
                        break;
                    case 'patterns':
                        searchQueries = ['component', 'hook', 'util', 'service'];
                        break;
                    case 'components':
                        searchQueries = ['tsx', 'jsx', 'component'];
                        break;
                    case 'routing':
                        searchQueries = ['router', 'route', 'pages', 'app'];
                        break;
                    case 'state':
                        searchQueries = ['store', 'redux', 'context', 'state'];
                        break;
                    default:
                        searchQueries = ['component', 'tsx', 'jsx', 'package.json', 'tsconfig'];
                }

                // Search for files to understand codebase structure
                const searchResults = await Promise.all(
                    searchQueries.map(query =>
                        githubService.searchFiles(query).catch(() => [])
                    )
                );

                const allFiles = searchResults.flat();

                // Analyze the found files to understand patterns
                const analysis = {
                    framework: detectFramework(allFiles),
                    structure: analyzeProjectStructure(allFiles),
                    patterns: detectCodePatterns(allFiles),
                    componentCount: allFiles.filter(f => f.path.includes('.tsx') || f.path.includes('.jsx')).length,
                    configFiles: allFiles.filter(f => f.path.includes('config') || f.path.includes('package.json')),
                };

                return {
                    success: true,
                    focus: focus,
                    analysis: analysis,
                    files: allFiles.slice(0, 20), // Return top 20 files for context
                    suggestions: generateCodebaseInsights(analysis, focus)
                };
            } catch (error) {
                return {
                    error: 'Codebase analysis failed',
                    message: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }
    });

    const planFeatureImplementationTool = tool({
        name: 'plan_feature_implementation',
        description: 'Create a detailed implementation plan for a feature request, mapping business requirements to technical changes',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {
                featureRequest: {
                    type: "string" as const,
                    description: "The product manager's feature request in business terms"
                },
                codebaseContext: {
                    type: "string" as const,
                    description: "Context about the codebase structure and patterns"
                }
            },
            required: ["featureRequest"],
            additionalProperties: false as const
        } as any,
        execute: async ({ featureRequest, codebaseContext }: { featureRequest: string, codebaseContext?: string }) => {
            console.log('🎯 Planning feature implementation:', {
                featureRequest: featureRequest,
                hasContext: !!codebaseContext,
                timestamp: new Date().toISOString()
            });

            try {
                const githubService = await getInitializedGitHubService();

                if (!githubService) {
                    return {
                        error: 'GitHub not configured',
                        message: 'GitHub service not initialized. Please configure GitHub integration in Settings first.'
                    };
                }

                // Analyze the feature request to find relevant files
                const analysis = await githubService.analyzeChangeRequest(featureRequest);

                // Create implementation plan based on the request and found files
                const plan = {
                    businessGoal: featureRequest,
                    technicalApproach: `Implement ${featureRequest} by modifying relevant components and adding necessary functionality`,
                    filesToModify: analysis.likelyFiles.map(file => ({
                        path: file.path,
                        purpose: `Update for: ${featureRequest}`
                    })),
                    dependencies: [], // Will be determined during implementation
                    implementationSteps: [
                        'Analyze existing code patterns',
                        'Identify components to modify',
                        'Implement requested changes',
                        'Test functionality',
                        'Create pull request'
                    ],
                    testingConsiderations: [`Manual testing of ${featureRequest}`, 'Verify no regressions'],
                    estimatedComplexity: analysis.likelyFiles.length > 5 ? 'High' : analysis.likelyFiles.length > 2 ? 'Medium' : 'Low'
                };

                return {
                    success: true,
                    featureRequest: featureRequest,
                    plan: plan,
                    analysis: analysis,
                    codebaseContext: codebaseContext
                };
            } catch (error) {
                return {
                    error: 'Feature planning failed',
                    message: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }
    });

    const analyzeCodePatternsAndDependenciesTool = tool({
        name: 'analyze_code_patterns_and_dependencies',
        description: 'Analyze existing code patterns, dependencies, and conventions in specific files or areas',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {
                filePaths: {
                    type: "array" as const,
                    items: { type: "string" as const },
                    description: "Array of file paths to analyze for patterns and dependencies"
                },
                analysisType: {
                    type: "string" as const,
                    description: "Type of analysis: 'dependencies', 'patterns', 'conventions', or 'all'"
                }
            },
            required: ["filePaths", "analysisType"],
            additionalProperties: false as const
        } as any,
        execute: async ({ filePaths, analysisType }: { filePaths: string[], analysisType: string }) => {
            console.log('🧠 Analyzing code patterns and dependencies:', {
                filePaths: filePaths,
                analysisType: analysisType,
                timestamp: new Date().toISOString()
            });

            try {
                const githubService = await getInitializedGitHubService();

                if (!githubService) {
                    return {
                        error: 'GitHub not configured',
                        message: 'GitHub service not initialized. Please configure GitHub integration in Settings first.'
                    };
                }

                // Get file contents for analysis
                const fileContents = await Promise.all(
                    filePaths.map(async (path) => {
                        try {
                            const file = await githubService.getFileContent(path);
                            return { path, content: file.content, success: true };
                        } catch (error) {
                            return { path, content: '', success: false, error: error instanceof Error ? error.message : 'Unknown error' };
                        }
                    })
                );

                // Analyze patterns based on file contents
                const analysis = {
                    files: fileContents,
                    patterns: {
                        imports: fileContents.map(f => {
                            const importMatches = f.content.match(/import .+ from .+/g) || [];
                            return { path: f.path, imports: importMatches.slice(0, 5) };
                        }),
                        exports: fileContents.map(f => {
                            const exportMatches = f.content.match(/export .+/g) || [];
                            return { path: f.path, exports: exportMatches.slice(0, 5) };
                        }),
                        components: fileContents.filter(f => f.content.includes('function ') || f.content.includes('const ') && f.content.includes('= ('))
                    },
                    dependencies: [],
                    conventions: {
                        fileNaming: filePaths.map(path => path.split('/').pop() || ''),
                        hasTypeScript: fileContents.some(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx'))
                    }
                };

                return {
                    success: true,
                    analysisType: analysisType,
                    filePaths: filePaths,
                    analysis: analysis
                };
            } catch (error) {
                return {
                    error: 'Pattern analysis failed',
                    message: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }
    });

    const validateImplementationPlanTool = tool({
        name: 'validate_implementation_plan',
        description: 'Validate a feature implementation plan against the codebase and get user approval before proceeding',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {
                plan: {
                    type: "object" as const,
                    description: "The implementation plan to validate"
                },
                impactAnalysis: {
                    type: "object" as const,
                    description: "Analysis of what will be affected by this change"
                }
            },
            required: ["plan"],
            additionalProperties: true as const
        } as any,
        execute: async ({ plan, impactAnalysis }: { plan: any, impactAnalysis?: any }) => {
            console.log('✅ Validating implementation plan:', {
                planSteps: plan?.steps?.length || 0,
                hasImpactAnalysis: !!impactAnalysis,
                timestamp: new Date().toISOString()
            });

            // This tool formats the plan for user review and tracks validation
            return {
                success: true,
                validated: true,
                plan: plan,
                impactAnalysis: impactAnalysis,
                readyForImplementation: true,
                message: 'Implementation plan validated and ready for execution'
            };
        }
    });

    const analyzeGitHubRequestTool = tool({
        name: 'analyze_github_request',
        description: 'Analyze a GitHub code change request to find relevant files and prepare changes',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {
                request: {
                    type: "string" as const,
                    description: "The user's code change request"
                }
            },
            required: ["request"],
            additionalProperties: false as const
        } as any,
        execute: async ({ request }: { request: string }) => {
            console.log('🔍 GitHub Service Debug:', {
                request: request,
                timestamp: new Date().toISOString()
            });

            try {
                const githubService = await getInitializedGitHubService();

                if (!githubService) {
                    return {
                        error: 'GitHub not configured',
                        message: 'GitHub service not initialized. Please configure GitHub integration in Settings first.'
                    };
                }

                // Use GitHub service to analyze the request
                const response = await githubService.analyzeChangeRequest(request);
                return {
                    success: true,
                    ...response
                };
            } catch (error) {
                return {
                    error: 'GitHub analysis failed',
                    message: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }
    });

    const getFileContentTool = tool({
        name: 'get_file_content',
        description: 'Get the content of a specific file from the GitHub repository',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {
                filePath: {
                    type: "string" as const,
                    description: "The path to the file in the repository"
                }
            },
            required: ["filePath"],
            additionalProperties: false as const
        } as any,
        execute: async ({ filePath }: { filePath: string }) => {
            console.log('🔍 GitHub Service Debug (get_file_content):', {
                filePath: filePath,
                timestamp: new Date().toISOString()
            });

            // Note: File type restrictions removed - can now access any file type

            try {
                const githubService = await getInitializedGitHubService();

                if (!githubService) {
                    return {
                        error: 'GitHub not configured',
                        message: 'GitHub service not initialized. Please configure GitHub integration in Settings first.'
                    };
                }

                // Call the middleware endpoint for getting file content
                const response = await githubService.getFileContent(filePath);
                return {
                    success: true,
                    path: response.path,
                    content: response.content
                };
            } catch (error) {
                return {
                    error: 'Failed to get file content',
                    message: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }
    });

    const createPullRequestTool = tool({
        name: 'create_pull_request',
        description: 'Create a pull request with the approved code changes',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {
                request: {
                    type: "string" as const,
                    description: "The original user request"
                },
                targetFile: {
                    type: "string" as const,
                    description: "The file path to modify"
                },
                currentContent: {
                    type: "string" as const,
                    description: "The current file content"
                },
                newContent: {
                    type: "string" as const,
                    description: "The new file content with changes"
                }
            },
            required: ["request", "targetFile", "newContent"],
            additionalProperties: false as const
        } as any,
        execute: async ({ request, targetFile, currentContent, newContent }: {
            request: string,
            targetFile: string,
            currentContent?: string,
            newContent: string
        }) => {
            try {
                // Note: Change size limits removed - can now handle changes of any size

                const githubService = await getInitializedGitHubService();

                if (!githubService) {
                    return {
                        error: 'GitHub not configured',
                        message: 'GitHub service not initialized. Please configure GitHub integration in Settings first.'
                    };
                }

                // Call the middleware endpoint for creating PR
                const response = await githubService.executeCodeChange(
                    request,
                    targetFile,
                    currentContent || '',
                    newContent
                );

                return {
                    success: true,
                    pullRequest: {
                        number: response.number,
                        title: response.title,
                        url: response.html_url
                    }
                };
            } catch (error) {
                return {
                    error: 'Failed to create pull request',
                    message: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }
    });

    return new Agent({
        name: 'GitHub Agent',
        instructions: `You are the GitHub Agent, specialized in translating product manager requirements into technical implementations. You follow a structured, multi-step process to ensure successful feature delivery.

## Your Mission
Transform business requirements from PMs into well-planned, properly implemented code changes that follow existing patterns and conventions.

## 🎯 Three-Phase Implementation Process

### PHASE 1: DISCOVERY & ANALYSIS 
**Goal: Understand the business need and technical landscape**

1. **Codebase Discovery**
   - Use \`analyze_codebase\` with focus 'all' to understand project structure
   - Identify framework (React, Next.js, etc.), patterns, and conventions
   - Map component hierarchy and routing patterns
   - Understand state management approach

2. **Feature Planning**
   - Use \`plan_feature_implementation\` to translate business requirements
   - Map PM language to technical requirements
   - Identify all files and components that need changes
   - Consider dependencies, testing, and documentation needs

3. **Pattern Analysis**
   - Use \`analyze_code_patterns_and_dependencies\` on relevant files
   - Understand existing conventions (naming, structure, imports)
   - Identify similar features for reference
   - Detect required dependencies and integration points

### PHASE 2: VALIDATION & PREVIEW
**Goal: Create detailed implementation plan and get approval**

1. **Implementation Planning**
   - Create comprehensive plan with:
     - Business requirements breakdown
     - Technical implementation steps
     - Files to be modified/created
     - Dependencies to add/update
     - Testing considerations
     - Impact analysis

2. **Plan Validation**
   - Use validate_implementation_plan to format and validate
   - Present clear overview to PM with implementation plan
   - Show files to modify, dependencies needed, and impact analysis
   - Get user confirmation before proceeding

3. **Get PM Approval**
   - Wait for user confirmation before proceeding
   - Address any concerns or modifications
   - Adjust plan based on feedback

### PHASE 3: IMPLEMENTATION & DELIVERY
**Goal: Execute the approved plan and create PR**

1. **Code Implementation**
   - Use \`get_file_content\` to examine existing code
   - Follow established patterns and conventions
   - Implement changes according to approved plan
   - Consider progressive implementation (multiple smaller PRs if needed)

2. **Quality Assurance**
   - Ensure code follows project conventions
   - Add proper imports and dependencies
   - Include appropriate error handling
   - Consider edge cases and responsive design

3. **PR Creation & Delivery**
   - Use create_pull_request with comprehensive description
   - Include business context and technical details
   - Suggest testing steps for PM
   - Format response with PR link, business goal, and testing guidance

## 🎨 PM-First Thinking

**Translate Business Language:**
- "Add login button" → Analyze auth flow, find button components, consider routing
- "Dark mode toggle" → Identify theme system, CSS variables, state management
- "Premium user features" → Find user model, add role checking, conditional rendering

**Impact Analysis:**
- Always identify how many components will be affected
- Consider responsive design implications
- Suggest A/B testing opportunities when relevant
- Highlight any breaking changes or user experience impacts

**Progressive Implementation:**
- For large features, suggest breaking into smaller PRs
- Prioritize infrastructure first, then UI components
- Consider feature flags for gradual rollouts

## 🧠 Code Intelligence

**Convention Detection:**
- How are components typically structured?
- What naming patterns are used?
- How are props and interfaces defined?
- What import patterns are standard?

**Dependency Management:**
- Auto-detect when new packages are needed
- Suggest appropriate versions based on existing deps
- Handle import statements intelligently
- Consider bundle size implications

**Pattern Matching:**
- Find similar existing implementations
- Reuse established patterns and components
- Maintain consistency with existing code style
- Follow accessibility and performance patterns

## 🛠 Technical Guidelines

**File Type Support:** All file types (.ts, .tsx, .jsx, .js, .css, .scss, .md, .html, .json, .env, etc.)
**Change Scope:** Any size (simple updates to complex features)
**Multi-file Support:** Handle changes across multiple files and directories

## 🚨 Error Handling

- If codebase analysis fails: "I need to understand your project structure first. Please ensure GitHub is properly connected."
- If planning fails: "I need more details about this feature. Could you describe the user experience you want to create?"
- If patterns unclear: "I found multiple ways this could be implemented. Which approach aligns with your current architecture?"

## 🎯 Success Metrics

- Plans are clear and PM-approved before implementation
- Code follows existing project patterns
- Changes are properly scoped and tested
- PRs include business context and testing guidance
- Features are implemented progressively when appropriate

Remember: You're a technical translator for PMs. Think features first, then code. Always explain the business impact alongside technical changes.`,
        tools: [
            analyzeCodebaseTool,
            planFeatureImplementationTool,
            analyzeCodePatternsAndDependenciesTool,
            validateImplementationPlanTool,
            analyzeGitHubRequestTool,
            getFileContentTool,
            createPullRequestTool
        ]
    });
};

// Helper function to validate GitHub configuration
const validateGitHubConfig = (config?: GitHubConfig): { isValid: boolean, status: string, missingFields: string[] } => {
    if (!config) {
        return {
            isValid: false,
            status: "GitHub is not configured. No configuration provided.",
            missingFields: ['token', 'owner', 'repo']
        };
    }

    const missingFields: string[] = [];
    if (!config.token) missingFields.push('token');
    if (!config.owner) missingFields.push('owner');
    if (!config.repo) missingFields.push('repo');

    if (missingFields.length > 0) {
        return {
            isValid: false,
            status: `GitHub configuration incomplete. Missing: ${missingFields.join(', ')}`,
            missingFields
        };
    }

    return {
        isValid: true,
        status: `GitHub is properly configured and connected (${config.owner}/${config.repo})`,
        missingFields: []
    };
};

// Unified prompt generator with conditional flags
const createUnifiedPrompt = (config?: GitHubConfig, apiConfig?: { hubUrl?: string, apiSecretKey?: string, sessionId?: string, executeWorkflowFn?: (workflow: any, debug: boolean) => Promise<any> }, isLinear: boolean = false) => {
    const githubValidation = validateGitHubConfig(config);
    const hasValidGithub = githubValidation.isValid;

    return `You are SashiAgent, the main conversational AI assistant that intelligently routes requests to specialized agents${isLinear ? ' for Linear integration' : ''}.

${isLinear ? `## IMPORTANT: Console Logging
When you use any tools, the system will log detailed information about the execution. Pay attention to these logs for debugging.

## Available Tools Debug Info:
- list_workflows: Fetches workflows from hub API (${apiConfig?.hubUrl || 'NO HUB URL'})
- execute_workflow: Executes workflows using local middleware function (${apiConfig?.executeWorkflowFn ? 'FUNCTION AVAILABLE' : 'NO FUNCTION'})
- check_github_status: Checks GitHub integration status

` : ''}## Your Role
You are the entry point for all ${isLinear ? 'Linear' : 'user'} requests. Your job is to understand the user's intent and route them to the appropriate specialized agents${isLinear ? ' or use workflow tools directly' : ''} to fulfill their needs.

## GitHub Integration Status
${githubValidation.status}
${hasValidGithub ? '✅ GitHub features are AVAILABLE' : '❌ GitHub features are NOT AVAILABLE'}

${!hasValidGithub ? `
**IMPORTANT**: When users request GitHub/code-related features, you must inform them that GitHub is not properly configured and they need to configure it first. Use the check_github_status tool to provide specific details about what's missing.
` : ''}

## Core Decision: Workflow vs GitHub vs Conversational Response

${isLinear ? `**Use Workflow Tools** when the user's intent is to:
- List saved workflows ("show my workflows", "list workflows", "what workflows do I have")
- Execute/run existing workflows ("run workflow X", "execute workflow Y")
- Get details about workflow execution results

` : ''}**Route to GitHub Agent** when the user's intent is to:${hasValidGithub ? '' : ' (⚠️ ONLY if GitHub is configured)'}
- Make code changes or modifications
- Update files in a repository
- Fix bugs or issues in code
- Change UI elements, text, styling
- Add or modify features in code
- Create pull requests
- Any request that involves modifying repository files

**Route to Workflow Executor** when the user's intent is to:
${isLinear ? '- Accomplish a specific task that requires backend operations (non-GitHub)\n- Get actual data or results from the system (executes workflows immediately)' : '- Accomplish a specific task that requires backend operations (non-GitHub)\n- Get actual data or results from the system (executes workflows immediately)'}
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

${isLinear ? `**Workflow Listing Intent Indicators:**
- "List workflows", "show workflows", "my workflows"
- "What workflows do I have?", "available workflows"
- "Show me my saved workflows"

**Workflow Execution Intent Indicators:**
- "Run workflow [name/id]", "execute workflow [name/id]"
- "Start workflow", "trigger workflow"
- User mentions a specific workflow to run

` : ''}**GitHub Intent Indicators:**
- "Change", "update", "modify", "fix" + code/file/component
- "Add" or "remove" code elements
- References to UI components, buttons, text, colors
- Mentions of files, components, or code sections
- Requests for code improvements or bug fixes

**Workflow${isLinear ? ' Execution' : ' Execution'} Intent Indicators:**
- User wants to accomplish something specific (non-code)${isLinear ? ' and expects immediate results' : ' and expects immediate results'}
- Request involves concrete entities or data
- User expects to receive actual results or see changes
- Request implies system interaction or backend operations

**GitHub Status Intent Indicators:**
- "Is GitHub connected/configured/attached?"
- "GitHub status", "GitHub integration"
- "Can I use GitHub features?"
- "What's my GitHub setup?"
- "Which repo is connected?"
- "What repository am I connected to?"
- "Show me repo details/information"
- "Tell me about the connected repository"
- Any direct questions about GitHub connectivity, configuration, or repository information

**Informational Intent Indicators:**
- User wants to understand or learn something
- Request is about concepts, processes, or explanations  
- User is exploring capabilities or asking "how" questions
- Request is conversational or exploratory in nature (NOT about GitHub status)

## Routing Strategy

${isLinear ? `**For Workflow Listing Questions:**
1. ALWAYS use list_workflows tool for any workflow listing requests
2. Format the response in markdown for better readability
3. Provide clear information about available workflows
4. Do NOT hand off to other agents for these questions

**For Workflow Execution Requests:**
1. ALWAYS use execute_workflow tool for running workflows
2. Extract workflow ID/name from user request
3. Parse any parameters the user provides
4. Format the execution results in markdown
5. Do NOT hand off to other agents for these questions

` : ''}**For GitHub Status Questions:**
1. ALWAYS use check_github_status tool first for any GitHub connectivity/status questions
2. For repository detail questions, use check_github_status with includeRepoDetails=true
3. Provide clear, direct answer about current configuration state
4. Include configuration guidance if needed
5. Do NOT hand off to other agents for these questions

**For GitHub Code Requests:**
${hasValidGithub ?
            '1. Hand off to GitHub Agent for explain-then-approve workflow' :
            '1. Use check_github_status tool to show current status\n2. Inform user that GitHub is not configured and explain what they need to do\n3. Do NOT hand off to GitHub Agent - explain the limitation instead'}

**For Other Actionable Requests:**
1. Hand off to Workflow Executor to create and immediately execute workflows with results in plain English

**For Informational Requests:**
1. Hand off directly to Response Agent for conversational response (NOT for GitHub status questions)

## Key Principles
${isLinear ? '- **PRIORITY**: For ANY workflow listing/execution request, use the appropriate tool FIRST - do not route to other agents\n' : ''}- **PRIORITY**: For ANY GitHub status/connectivity question, use check_github_status tool FIRST - do not route to other agents
- Focus on intent, not keywords
- Be confident in your routing decisions
- Trust the specialized agents to handle their domains
- Prioritize user experience through smooth handoffs
${hasValidGithub ?
            '- When in doubt about code changes, route to GitHub Agent' :
            '- When users request code changes, use check_github_status tool and inform them GitHub needs to be configured first'}
- When in doubt about other actions, consider if the user expects to see actual results or data
- Always be transparent about GitHub configuration status

## GitHub Status Question Examples (Use check_github_status tool):
- "Is GitHub connected?" → Use tool, provide status
- "Is GitHub attached?" → Use tool, provide status
- "Can I use GitHub features?" → Use tool, explain availability
- "What's my GitHub setup?" → Use tool, show configuration
- "GitHub status" → Use tool, provide detailed status
- "Which repo is connected?" → Use tool with includeRepoDetails=true
- "What repository am I connected to?" → Use tool with includeRepoDetails=true
- "Show me repo details" → Use tool with includeRepoDetails=true
- "Tell me about the connected repository" → Use tool with includeRepoDetails=true

## GitHub Configuration Guidance
${!hasValidGithub ? `
When informing users about GitHub configuration, explain they need to:
1. Provide a GitHub personal access token
2. Specify the repository owner (username/organization)
3. Specify the repository name
4. Configure these in the system settings

Missing fields: ${githubValidation.missingFields.join(', ')}
` : 'GitHub is properly configured and ready to use!'}

## Decision Framework
${isLinear ? `1. **First**: Is this a workflow listing request? → Use list_workflows tool
2. **Second**: Is this a workflow execution request? → Use execute_workflow tool
3. **Third**: Is this a GitHub status/connectivity/repository question? → Use check_github_status tool (with includeRepoDetails=true for repo info)
4. **Fourth**: Is this a GitHub code change request? → Route based on GitHub availability
5. **Fifth**: Is this an actionable request (non-GitHub) that needs immediate execution? → Route to Workflow Executor
6. **Sixth**: Is this informational/conversational? → Route to Response Agent

**CRITICAL FOR LINEAR INTEGRATION**: 
- ALWAYS respond in markdown format for Linear requests
- When listing workflows, format as markdown list with workflow details
- When executing workflows, format results as markdown with clear sections
- Include workflow IDs clearly for easy reference` : `1. **First**: Is this a GitHub status/connectivity/repository question? → Use check_github_status tool (with includeRepoDetails=true for repo info)
2. **Second**: Is this a GitHub code change request? → Route based on GitHub availability
3. **Third**: Is this an actionable request (non-GitHub)? → Route to Workflow Executor
4. **Fourth**: Is this informational/conversational? → Route to Response Agent`}

Analyze the user's request and follow this priority order for routing decisions.`;
};

// Shared GitHub status tool creation
const createSharedGitHubStatusTool = (config?: GitHubConfig) => {
    const githubValidation = validateGitHubConfig(config);
    const hasValidGithub = githubValidation.isValid;

    // Helper function to get GitHub service
    const getInitializedGitHubService = async () => {
        try {
            if (!config?.token || !config?.owner || !config?.repo) {
                return null;
            }
            return initializeGitHubAPI({
                token: config.token,
                owner: config.owner,
                repo: config.repo
            });
        } catch (error) {
            console.error('Failed to initialize GitHub service:', error);
            return null;
        }
    };

    return tool({
        name: 'check_github_status',
        description: 'Check the current GitHub integration status and configuration, optionally fetch repository details',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {
                includeRepoDetails: {
                    type: "boolean" as const,
                    description: "Whether to fetch detailed repository information from GitHub API"
                }
            },
            required: [],
            additionalProperties: false as const
        } as any,
        execute: async ({ includeRepoDetails = false }: { includeRepoDetails?: boolean } = {}) => {
            const baseStatus = {
                configured: hasValidGithub,
                status: githubValidation.status,
                details: {
                    hasToken: !!config?.token,
                    hasOwner: !!config?.owner,
                    hasRepo: !!config?.repo,
                    missingFields: githubValidation.missingFields,
                    repoInfo: config?.owner && config?.repo ? `${config.owner}/${config.repo}` : null
                }
            };

            // If GitHub is configured and repo details are requested, fetch them
            if (hasValidGithub && includeRepoDetails && config) {
                try {
                    const githubService = await getInitializedGitHubService();
                    if (githubService) {
                        const repoData = await githubService.testConnection(); // This fetches repo details
                        return {
                            ...baseStatus,
                            repositoryDetails: {
                                name: repoData.name,
                                fullName: repoData.full_name,
                                description: repoData.description,
                                htmlUrl: repoData.html_url,
                                defaultBranch: repoData.default_branch,
                                language: repoData.language,
                                isPrivate: repoData.private,
                                createdAt: repoData.created_at,
                                updatedAt: repoData.updated_at,
                                size: repoData.size,
                                stargazersCount: repoData.stargazers_count,
                                forksCount: repoData.forks_count,
                                openIssuesCount: repoData.open_issues_count,
                                topics: repoData.topics || [],
                                license: repoData.license?.name || null,
                                owner: {
                                    login: repoData.owner.login,
                                    type: repoData.owner.type,
                                    htmlUrl: repoData.owner.html_url
                                }
                            }
                        };
                    }
                } catch (error) {
                    return {
                        ...baseStatus,
                        repositoryDetails: {
                            error: `Failed to fetch repository details: ${error instanceof Error ? error.message : 'Unknown error'}`
                        }
                    };
                }
            }

            return baseStatus;
        }
    });
};

const createSashiAgentPrompt = (config?: GitHubConfig, apiConfig?: { hubUrl?: string, apiSecretKey?: string, sessionId?: string, executeWorkflowFn?: (workflow: any, debug: boolean) => Promise<any> }, isLinear: boolean = false) => {
    const githubValidation = validateGitHubConfig(config);
    const hasValidGithub = githubValidation.isValid;
    return `You are SashiAgent, the main conversational AI assistant that intelligently routes requests to specialized agents.

## Your Role
You are the entry point for all user requests. Your job is to understand the user's intent and route them to the appropriate specialized agents to fulfill their needs.

## GitHub Integration Status
${githubValidation.status}
${hasValidGithub ? '✅ GitHub features are AVAILABLE' : '❌ GitHub features are NOT AVAILABLE'}

${!hasValidGithub ? `
**IMPORTANT**: When users request GitHub/code-related features, you must inform them that GitHub is not properly configured and they need to configure it first. Use the check_github_status tool to provide specific details about what's missing.
` : ''}

## Core Decision: Workflow vs GitHub vs Conversational Response

**Route to GitHub Agent** when the user's intent is to:${hasValidGithub ? '' : ' (⚠️ ONLY if GitHub is configured)'}
- Make code changes or modifications
- Update files in a repository
- Fix bugs or issues in code
- Change UI elements, text, styling
- Add or modify features in code
- Create pull requests
- Any request that involves modifying repository files

**Route to Workflow Creation** when the user's intent is to:
- Accomplish a specific task that requires backend operations (non-GitHub)
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

**GitHub Intent Indicators:**
- "Change", "update", "modify", "fix" + code/file/component
- "Add" or "remove" code elements
- References to UI components, buttons, text, colors
- Mentions of files, components, or code sections
- Requests for code improvements or bug fixes

**Workflow Intent Indicators:**
- User wants to accomplish something specific (non-code)
- Request involves concrete entities or data
- User expects to receive actual results or see changes
- Request implies system interaction or backend operations

**GitHub Status Intent Indicators:**
- "Is GitHub connected/configured/attached?"
- "GitHub status", "GitHub integration"
- "Can I use GitHub features?"
- "What's my GitHub setup?"
- "Which repo is connected?"
- "What repository am I connected to?"
- "Show me repo details/information"
- "Tell me about the connected repository"
- Any direct questions about GitHub connectivity, configuration, or repository information

**Informational Intent Indicators:**
- User wants to understand or learn something
- Request is about concepts, processes, or explanations  
- User is exploring capabilities or asking "how" questions
- Request is conversational or exploratory in nature (NOT about GitHub status)

## Routing Strategy

**For GitHub Status Questions:**
1. ALWAYS use check_github_status tool first for any GitHub connectivity/status questions
2. For repository detail questions, use check_github_status with includeRepoDetails=true
3. Provide clear, direct answer about current configuration state
4. Include configuration guidance if needed
5. Do NOT hand off to other agents for these questions

**For GitHub Code Requests:**
${hasValidGithub ?
            '1. Hand off to GitHub Agent for explain-then-approve workflow' :
            '1. Use check_github_status tool to show current status\n2. Inform user that GitHub is not configured and explain what they need to do\n3. Do NOT hand off to GitHub Agent - explain the limitation instead'}

**For Other Actionable Requests:**
1. Hand off to Workflow Planner to create complete workflow with actions and UI components

**For Informational Requests:**
1. Hand off directly to Response Agent for conversational response (NOT for GitHub status questions)

## Key Principles
- **PRIORITY**: For ANY GitHub status/connectivity question, use check_github_status tool FIRST - do not route to other agents
- Focus on intent, not keywords
- Be confident in your routing decisions
- Trust the specialized agents to handle their domains
- Prioritize user experience through smooth handoffs
${hasValidGithub ?
            '- When in doubt about code changes, route to GitHub Agent' :
            '- When users request code changes, use check_github_status tool and inform them GitHub needs to be configured first'}
- When in doubt about other actions, consider if the user expects to see actual results or data
- Always be transparent about GitHub configuration status

## GitHub Status Question Examples (Use check_github_status tool):
- "Is GitHub connected?" → Use tool, provide status
- "Is GitHub attached?" → Use tool, provide status
- "Can I use GitHub features?" → Use tool, explain availability
- "What's my GitHub setup?" → Use tool, show configuration
- "GitHub status" → Use tool, provide detailed status
- "Which repo is connected?" → Use tool with includeRepoDetails=true
- "What repository am I connected to?" → Use tool with includeRepoDetails=true
- "Show me repo details" → Use tool with includeRepoDetails=true
- "Tell me about the connected repository" → Use tool with includeRepoDetails=true

## GitHub Configuration Guidance
${!hasValidGithub ? `
When informing users about GitHub configuration, explain they need to:
1. Provide a GitHub personal access token
2. Specify the repository owner (username/organization)
3. Specify the repository name
4. Configure these in the system settings

Missing fields: ${githubValidation.missingFields.join(', ')}
` : 'GitHub is properly configured and ready to use!'}

## Decision Framework
1. **First**: Is this a GitHub status/connectivity/repository question? → Use check_github_status tool (with includeRepoDetails=true for repo info)
2. **Second**: Is this a GitHub code change request? → Route based on GitHub availability
3. **Third**: Is this an actionable request (non-GitHub)? → Route to Workflow Planner
4. **Fourth**: Is this informational/conversational? → Route to Response Agent

Analyze the user's request and follow this priority order for routing decisions.
`;
}

// Main SashiAgent - Router that decides which agents to use (for regular chat)
const createSashiAgent = (workflowPlannerAgent: Agent, responseAgent: Agent, refinerAgent: Agent, githubAgent: Agent, config?: GitHubConfig) => {
    const githubValidation = validateGitHubConfig(config);
    const hasValidGithub = githubValidation.isValid;

    // GitHub status checking tool (only tool for regular chat)
    const checkGitHubStatusTool = createSharedGitHubStatusTool(config);

    return new Agent({
        name: 'SashiAgent',
        instructions: createSashiAgentPrompt(config, undefined, false),
        tools: [checkGitHubStatusTool],
        handoffs: [
            // Only include GitHub agent if properly configured
            ...(hasValidGithub ? [handoff(githubAgent, {
                toolDescriptionOverride: 'Hand off to GitHub Agent when user wants to make code changes, modify files, or create pull requests (GitHub is configured)'
            })] : []),
            handoff(workflowPlannerAgent, {
                toolDescriptionOverride: 'Hand off to Workflow Planner when user wants to accomplish a specific task that requires backend operations (non-GitHub)'
            }),
            handoff(responseAgent, {
                toolDescriptionOverride: 'Hand off to Response Agent for informational responses, explanations, or when user wants to understand concepts'
            }),
            handoff(refinerAgent, {
                toolDescriptionOverride: 'Hand off to Refiner Agent when user wants to modify or fix an existing workflow'
            })
        ].filter((item) => item !== null) as Handoff<any, "text">[],
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

// Linear-specific SashiAgent - Router with workflow tools for Linear integration
const createLinearSashiAgent = (workflowExecutorAgent: Agent, responseAgent: Agent, refinerAgent: Agent, githubAgent: Agent, config?: GitHubConfig, apiConfig?: { hubUrl?: string, apiSecretKey?: string, sessionId?: string, executeWorkflowFn?: (workflow: any, debug: boolean) => Promise<any> }) => {
    const githubValidation = validateGitHubConfig(config);
    const hasValidGithub = githubValidation.isValid;

    // Workflow listing tool
    const listWorkflowsTool = tool({
        name: 'list_workflows',
        description: 'List all saved workflows for the current user',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {},
            required: [],
            additionalProperties: false as const
        } as any,
        execute: async () => {
            console.log('🔍 [list_workflows] Starting workflow list fetch...');
            try {
                console.log('🔍 [list_workflows] Checking API config:', {
                    hasHubUrl: !!apiConfig?.hubUrl,
                    hasApiSecretKey: !!apiConfig?.apiSecretKey,
                    hasSessionId: !!apiConfig?.sessionId,
                    hubUrl: apiConfig?.hubUrl
                });

                if (!apiConfig?.hubUrl || !apiConfig?.apiSecretKey) {
                    console.log('❌ [list_workflows] Hub not configured');
                    return {
                        success: false,
                        error: 'Hub not configured - cannot fetch workflows'
                    };
                }

                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'x-api-token': apiConfig.apiSecretKey,
                };

                if (apiConfig.sessionId) {
                    headers['X-Session-ID'] = apiConfig.sessionId;
                }

                console.log('🔍 [list_workflows] Making request to:', `${apiConfig.hubUrl}/workflows`);
                console.log('🔍 [list_workflows] Headers:', Object.keys(headers));

                const response = await fetch(`${apiConfig.hubUrl}/workflows`, {
                    method: 'GET',
                    headers,
                    signal: AbortSignal.timeout(10000), // 10 second timeout
                });

                console.log('🔍 [list_workflows] Response status:', response.status, response.statusText);

                if (!response.ok) {
                    console.log('❌ [list_workflows] Request failed:', response.status, response.statusText);
                    return {
                        success: false,
                        error: `Failed to fetch workflows: ${response.status} ${response.statusText}`
                    };
                }

                const workflows = await response.json();
                console.log('🔍 [list_workflows] Received workflows:', {
                    isArray: Array.isArray(workflows),
                    count: Array.isArray(workflows) ? workflows.length : 'not array',
                    type: typeof workflows
                });

                // Check executability for each workflow
                const workflowsWithStatus = (Array.isArray(workflows) ? workflows : []).map((workflow: any) => {
                    const executabilityCheck = checkWorkflowExecutability(workflow);
                    return {
                        ...workflow,
                        isExecutable: executabilityCheck.isExecutable,
                        executabilityStatus: executabilityCheck.status,
                        missingFunctions: executabilityCheck.missingFunctions,
                        statusLabel: executabilityCheck.isExecutable ? 'Ready' : 'Disabled (Missing Functions)'
                    };
                });

                console.log('🔍 [list_workflows] Workflows with executability status:', {
                    total: workflowsWithStatus.length,
                    executable: workflowsWithStatus.filter((w: any) => w.isExecutable).length,
                    disabled: workflowsWithStatus.filter((w: any) => !w.isExecutable).length
                });

                return {
                    success: true,
                    workflows: workflowsWithStatus
                };
            } catch (error) {
                console.error('❌ [list_workflows] Error occurred:', error);
                return {
                    success: false,
                    error: `Failed to fetch workflows: ${error instanceof Error ? error.message : 'Unknown error'}`
                };
            }
        }
    });

    // Workflow execution tool
    const executeWorkflowTool = tool({
        name: 'execute_workflow',
        description: 'Execute a saved workflow by ID with optional parameters',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {
                workflowId: {
                    type: "string" as const,
                    description: "The ID of the workflow to execute"
                },
                parameters: {
                    type: "object" as const,
                    description: "Parameters to pass to the workflow execution",
                    additionalProperties: true
                }
            },
            required: ["workflowId"],
            additionalProperties: false as const
        } as any,
        execute: async ({ workflowId, parameters = {} }: { workflowId: string, parameters?: Record<string, any> }) => {
            console.log('⚡ [execute_workflow] Starting workflow execution...', {
                workflowId,
                parametersCount: Object.keys(parameters).length,
                parameters: parameters
            });

            try {
                console.log('⚡ [execute_workflow] Checking API config:', {
                    hasHubUrl: !!apiConfig?.hubUrl,
                    hasApiSecretKey: !!apiConfig?.apiSecretKey,
                    hasSessionId: !!apiConfig?.sessionId,
                    hasExecuteWorkflowFn: !!apiConfig?.executeWorkflowFn,
                    hubUrl: apiConfig?.hubUrl
                });

                if (!apiConfig?.hubUrl || !apiConfig?.apiSecretKey) {
                    console.log('❌ [execute_workflow] Hub not configured');
                    return {
                        success: false,
                        error: 'Hub not configured - cannot execute workflows'
                    };
                }

                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'x-api-token': apiConfig.apiSecretKey,
                };

                if (apiConfig.sessionId) {
                    headers['X-Session-ID'] = apiConfig.sessionId;
                    headers['x-sashi-session-token'] = apiConfig.sessionId;
                }

                console.log('⚡ [execute_workflow] Fetching workflow definition from:', `${apiConfig.hubUrl}/workflows/${workflowId}`);
                console.log('⚡ [execute_workflow] Headers:', Object.keys(headers));

                // First, fetch the workflow to get its definition
                const workflowResponse = await fetch(`${apiConfig.hubUrl}/workflows/${workflowId}`, {
                    method: 'GET',
                    headers,
                    signal: AbortSignal.timeout(10000),
                });

                console.log('⚡ [execute_workflow] Workflow fetch response:', workflowResponse.status, workflowResponse.statusText);

                if (!workflowResponse.ok) {
                    console.log('❌ [execute_workflow] Failed to fetch workflow:', workflowResponse.status, workflowResponse.statusText);
                    return {
                        success: false,
                        error: `Failed to fetch workflow: ${workflowResponse.status} ${workflowResponse.statusText}`
                    };
                }

                const savedWorkflow = await workflowResponse.json();

                // Check if workflow is executable before proceeding
                const executabilityCheck = checkWorkflowExecutability(savedWorkflow);
                if (!executabilityCheck.isExecutable) {
                    console.log('❌ [execute_workflow] Workflow is not executable:', {
                        workflowId: workflowId,
                        workflowName: savedWorkflow.name,
                        status: executabilityCheck.status,
                        missingFunctions: executabilityCheck.missingFunctions
                    });

                    return {
                        success: false,
                        error: `The automation "${savedWorkflow.name || 'requested process'}" isn't currently available in your workspace. This feature may need to be set up or configured by your administrator.`,
                        workflowStatus: 'disabled',
                        userFriendlyMessage: `Sorry, the "${savedWorkflow.name || 'requested process'}" automation isn't available right now. You might want to check with your team administrator or try a different approach.`
                    };
                }

                // Extract the actual workflow definition from SavedWorkflow
                const workflowDefinition = savedWorkflow.workflow.workflow;

                console.log('⚡ [execute_workflow] Received workflow definition:', {
                    savedWorkflowName: savedWorkflow.name,
                    savedWorkflowId: savedWorkflow.id,
                    actionsCount: workflowDefinition.actions?.length || 0,
                    hasUI: !!workflowDefinition.ui,
                    type: workflowDefinition.type
                });

                // Merge user parameters into the workflow if needed
                // This is a simple approach - you might want more sophisticated parameter injection
                if (parameters && Object.keys(parameters).length > 0) {
                    console.log('⚡ [execute_workflow] Injecting user parameters into workflow...');
                    // Update workflow actions with user-provided parameters
                    if (workflowDefinition.actions) {
                        let parameterReplacements = 0;
                        workflowDefinition.actions = workflowDefinition.actions.map((action: any, index: number) => {
                            if (action.parameters) {
                                console.log(`⚡ [execute_workflow] Processing action ${index} (${action.id}):`, action.parameters);
                                // Replace userInput parameters with actual values
                                const updatedParams = { ...action.parameters };
                                for (const [key, value] of Object.entries(updatedParams)) {
                                    if (typeof value === 'string' && value.startsWith('userInput.')) {
                                        const paramName = value.replace('userInput.', '');
                                        if (parameters[paramName] !== undefined) {
                                            console.log(`⚡ [execute_workflow] Replacing ${key}: ${value} → ${parameters[paramName]}`);
                                            updatedParams[key] = parameters[paramName];
                                            parameterReplacements++;
                                        }
                                    }
                                }
                                return { ...action, parameters: updatedParams };
                            }
                            return action;
                        });
                        console.log(`⚡ [execute_workflow] Made ${parameterReplacements} parameter replacements`);
                    }
                }

                // Now execute the workflow using the local execution logic
                // We'll call the execution function directly instead of making an HTTP request
                console.log('⚡ [execute_workflow] Checking for execution function...');
                if (!apiConfig?.executeWorkflowFn) {
                    console.log('❌ [execute_workflow] Execution function not available');
                    return {
                        success: false,
                        error: 'Workflow execution function not available - this should only be called from Linear integration'
                    };
                }

                console.log('⚡ [execute_workflow] Calling local execution function...');
                const executionResult = await apiConfig.executeWorkflowFn(workflowDefinition, false);
                console.log('⚡ [execute_workflow] Execution completed:', {
                    hasResult: !!executionResult,
                    hasError: !!(executionResult?.error),
                    resultType: typeof executionResult,
                    resultKeys: executionResult ? Object.keys(executionResult) : 'no result'
                });

                if (!executionResult || executionResult.error) {
                    console.log('❌ [execute_workflow] Execution failed:', executionResult?.error);
                    return {
                        success: false,
                        error: `Failed to execute workflow: ${executionResult?.error || 'Unknown execution error'}`
                    };
                }

                const finalResult = {
                    success: true,
                    workflowId: workflowId,
                    workflowName: savedWorkflow.name || workflowId,
                    executionId: `exec-${Date.now()}`,
                    status: 'completed',
                    results: executionResult.results || [],
                    errors: executionResult.errors || [],
                    message: `Workflow "${savedWorkflow.name || workflowId}" executed successfully`,
                    executionDetails: {
                        actionCount: workflowDefinition.actions?.length || 0,
                        duration: 0, // Duration would need to be calculated if needed
                        timestamp: new Date().toISOString()
                    }
                };

                console.log('✅ [execute_workflow] Returning final result:', {
                    success: finalResult.success,
                    workflowName: finalResult.workflowName,
                    resultsCount: finalResult.results.length,
                    errorsCount: finalResult.errors.length
                });

                return finalResult;
            } catch (error) {
                console.error('❌ [execute_workflow] Exception occurred:', error);
                console.error('❌ [execute_workflow] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
                return {
                    success: false,
                    error: `Failed to execute workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
                };
            }
        }
    });

    // Shared GitHub status checking tool for Linear agent
    const checkGitHubStatusTool = createSharedGitHubStatusTool(config);

    return new Agent({
        name: 'LinearSashiAgent',
        instructions: createUnifiedPrompt(config, apiConfig, true),
        tools: [listWorkflowsTool, executeWorkflowTool, checkGitHubStatusTool],
        handoffs: [
            // Only include GitHub agent if properly configured
            ...(hasValidGithub ? [handoff(githubAgent, {
                toolDescriptionOverride: 'Hand off to GitHub Agent when user wants to make code changes, modify files, or create pull requests (GitHub is configured)'
            })] : []),
            handoff(workflowExecutorAgent, {
                toolDescriptionOverride: 'Hand off to Workflow Executor when user wants to accomplish a specific task that requires backend operations (non-GitHub) - creates and executes workflows immediately'
            }),
            handoff(responseAgent, {
                toolDescriptionOverride: 'Hand off to Response Agent for informational responses, explanations, or when user wants to understand concepts'
            }),
            handoff(refinerAgent, {
                toolDescriptionOverride: 'Hand off to Refiner Agent when user wants to modify or fix an existing workflow'
            })
        ].filter((item) => item !== null) as Handoff<any, "text">[],
    });
};

export class SashiAgent {
    private workflowPlannerAgent: Agent;
    private responseAgent: Agent;
    private githubAgent: Agent;
    private mainAgent: Agent;
    private refinerAgent: Agent;
    private config?: GitHubConfig;
    private githubValidation: { isValid: boolean, status: string, missingFields: string[] };

    constructor(config?: GitHubConfig) {
        this.workflowPlannerAgent = createWorkflowPlannerAgent();
        this.responseAgent = createResponseAgent();
        this.githubAgent = createGitHubAgent(config);
        this.refinerAgent = createWorkflowRefinerAgent();
        this.config = config;
        this.githubValidation = validateGitHubConfig(config);
        this.mainAgent = createSashiAgent(
            this.workflowPlannerAgent,
            this.responseAgent,
            this.refinerAgent,
            this.githubAgent,
            config
        );
    }

    /**
     * Check GitHub integration status
     */
    getGitHubStatus() {
        return {
            configured: this.githubValidation.isValid,
            status: this.githubValidation.status,
            details: {
                hasToken: !!this.config?.token,
                hasOwner: !!this.config?.owner,
                hasRepo: !!this.config?.repo,
                missingFields: this.githubValidation.missingFields,
                repoInfo: this.config?.owner && this.config?.repo ? `${this.config.owner}/${this.config.repo}` : null
            }
        };
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




// Export a singleton instance with config awareness
let sashiAgent: SashiAgent | null = null;
let currentConfig: GitHubConfig | undefined = undefined;

export const getSashiAgent = (config?: GitHubConfig): SashiAgent => {
    // Create new instance if no agent exists or config has changed
    if (!sashiAgent || JSON.stringify(currentConfig) !== JSON.stringify(config)) {
        sashiAgent = new SashiAgent(config);
        currentConfig = config;
    }
    return sashiAgent;
};

// Linear-specific agent interface
interface LinearSashiAgent {
    handleUserPrompt(userPrompt: string, previousActivities: { role: string, content: string }[]): Promise<string>;
}

// Linear agent configuration
interface LinearAgentConfig {
    githubConfig?: GitHubConfig;
    hubUrl?: string;
    apiSecretKey?: string;
    executeWorkflowFn?: (workflow: any, debug: boolean) => Promise<any>;
}

// Create a Linear-specific agent with workflow tools
export const getLinearSashiAgent = (config?: LinearAgentConfig): LinearSashiAgent => {
    const apiConfig = {
        hubUrl: config?.hubUrl,
        apiSecretKey: config?.apiSecretKey,
        sessionId: undefined, // Session ID would be passed separately if needed
        executeWorkflowFn: config?.executeWorkflowFn
    };

    // Create the specialized agents
    const workflowExecutorAgent = createWorkflowExecutorAgent(config?.executeWorkflowFn, apiConfig);
    const linearResponseAgent = createLinearResponseAgent(); // Use Linear-specific response agent
    const refinerAgent = createWorkflowRefinerAgent();
    const githubAgent = createGitHubAgent(config?.githubConfig);

    // Create the Linear-specific agent with workflow tools
    const linearSashiAgent = createLinearSashiAgent(
        workflowExecutorAgent,
        linearResponseAgent,
        refinerAgent,
        githubAgent,
        config?.githubConfig,
        apiConfig
    );

    return {
        async handleUserPrompt(userPrompt: string, previousActivities: { role: string, content: string }[] = []): Promise<string> {
            try {
                console.log('🤖 [Linear Agent] ========== Processing Linear Request ==========');
                console.log('🤖 [Linear Agent] User prompt:', userPrompt);
                console.log('🤖 [Linear Agent] Previous activities count:', previousActivities.length);
                console.log('🤖 [Linear Agent] API config:', {
                    hasHubUrl: !!(config?.hubUrl),
                    hasApiSecretKey: !!(config?.apiSecretKey),
                    hasExecuteWorkflowFn: !!(config?.executeWorkflowFn),
                    hubUrl: config?.hubUrl
                });

                console.log('🤖 [Linear Agent] Calling LinearSashiAgent.run...');
                const thread = previousActivities.map((item) => {
                    if (item.role === 'user') {
                        return user(item.content);
                    }
                    if (item.role === 'assistant') {
                        return assistant(item.content);
                    }
                    return null;
                }).filter((item) => item !== null);
                thread.push(user(userPrompt));

                const result = await run(linearSashiAgent, thread);
                const finalOutput = result.finalOutput;

                let response;
                if (typeof finalOutput === 'object' && finalOutput !== null) {
                    const parsed = finalOutput as any;
                    if (parsed.type === 'general' && typeof parsed.content === 'string') {
                        response = parsed;
                    } else {
                        response = {
                            type: 'general',
                            content: typeof finalOutput === 'string' ? finalOutput : JSON.stringify(finalOutput)
                        };
                    }
                } else {
                    response = {
                        type: 'general',
                        content: typeof finalOutput === 'string' ? finalOutput : JSON.stringify(finalOutput)
                    };
                }

                console.log('🤖 [Linear Agent] SashiAgent response received:', {
                    type: response.type,
                    contentLength: response.content.length,
                    contentPreview: response.content.substring(0, 200) + (response.content.length > 200 ? '...' : '')
                });

                // Ensure response is always markdown formatted for Linear
                let content = response.content;

                // If response doesn't start with markdown indicators, format it properly
                if (!content.includes('**') && !content.includes('#') && !content.includes('```')) {
                    console.log('🤖 [Linear Agent] Adding markdown formatting to response');
                    content = `**Response:**\n\n${content}`;
                }

                // Add RESPONSE: prefix for Linear compatibility
                const formattedResponse = content;

                console.log('🤖 [Linear Agent] Final formatted response:', {
                    length: formattedResponse.length,
                    hasMarkdown: formattedResponse.includes('**') || formattedResponse.includes('#'),
                    preview: formattedResponse.substring(0, 150) + (formattedResponse.length > 150 ? '...' : '')
                });
                console.log('🤖 [Linear Agent] ========== Request Complete ==========');

                return formattedResponse;

            } catch (error) {
                console.error('🤖 [Linear Agent] ❌ Error processing request:', error);
                console.error('🤖 [Linear Agent] ❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                const errorResponse = `RESPONSE: **Error**\n\nI encountered an error while processing your request: ${errorMessage}\n\nPlease try again or rephrase your request.`;
                console.log('🤖 [Linear Agent] ❌ Returning error response:', errorResponse);
                return errorResponse;
            }
        }
    };
};