import { Agent, AgentInputItem, assistant, Handoff, handoff, run, tool, user } from '@openai/agents';
import { z } from 'zod';
import { generateSplitToolSchemas } from './ai-function-loader';
import { GitHubConfig, initializeGitHubAPI } from './github-api-service';
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

## Output Component Data Formatting
**CRITICAL**: The UI components expect data in specific formats. When actions return results, ensure they match these expected structures:

### Table Component Data Format
For "table" outputComponents, the action result MUST be formatted as:
\`\`\`json
{
  "data": [
    {"column1": "value1", "column2": "value2", ...},
    {"column1": "value3", "column2": "value4", ...}
  ]
}
\`\`\`
The TableComponent expects: \`data.data\` (array of objects where each object represents a row)

### DataCard Component Data Format  
For "dataCard" outputComponents, the action result should be a single object:
\`\`\`json
{
  "field1": "value1",
  "field2": "value2", 
  ...
}
\`\`\`
The DataCardComponent expects the object properties directly.

### Backend Function Return Guidelines
- Functions that return arrays (like bulk operations with map:true) should wrap results in \`{"data": [...results...]}\`
- Functions that return single objects can return the object directly
- For CSV mapping operations with table output, ensure the mapped results are collected into the proper array format

**Example workflow with proper table formatting:**
\`\`\`workflow
Action with map:true → Returns array of email results
Expected result format: {"data": [{"email":"user1@example.com","status":"sent"}, {"email":"user2@example.com","status":"sent"}]}
UI outputComponent: {"actionId": "send_email", "component": "table", "props": {}}
\`\`\`

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

// Main SashiAgent - Router that decides which agents to use
const createSashiAgent = (workflowPlannerAgent: Agent, responseAgent: Agent, refinerAgent: Agent, githubAgent: Agent, config?: GitHubConfig) => {
    const githubValidation = validateGitHubConfig(config);
    const hasValidGithub = githubValidation.isValid;

    // GitHub status checking tool
    const checkGitHubStatusTool = tool({
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

    // Helper function to get GitHub service (moved up for reuse)
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

    return new Agent({
        name: 'SashiAgent',
        instructions: `You are SashiAgent, the main conversational AI assistant that intelligently routes requests to specialized agents.

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

Analyze the user's request and follow this priority order for routing decisions.`,
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

// =============== LINEAR AGENT ===============
// Linear Agent - Handles Linear app integration with text-only responses using proper Linear agent pattern

/**
 * Linear Sashi Agent Tools
 */
export const LinearSashiAgentTools = {
    /**
     * List all available workflows
     */
    listWorkflows: async (config: { hubUrl: string, apiSecretKey: string }) => {
        try {
            const response = await fetch(`${config.hubUrl}/workflows`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sashi-api-token': config.apiSecretKey
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch workflows: ${response.statusText}`);
            }

            const workflows = await response.json();

            if (!Array.isArray(workflows) || workflows.length === 0) {
                return "No workflows found. You can create workflows using the main Sashi interface.";
            }

            // Format workflows as readable text
            let result = "**Your Saved Workflows:**\n\n";
            workflows.forEach((workflow: any, index: number) => {
                result += `${index + 1}. **${workflow.name || 'Unnamed Workflow'}**\n`;
                result += `   ID: ${workflow.id}\n`;
                if (workflow.description) {
                    result += `   Description: ${workflow.description}\n`;
                }
                result += `   Created: ${new Date(workflow.timestamp || workflow.createdAt).toLocaleDateString()}\n`;
                if (workflow.workflow?.actions) {
                    result += `   Actions: ${workflow.workflow.actions.length} steps\n`;
                }
                result += "\n";
            });

            result += "To run a workflow, use: executeWorkflow(workflow_id)";

            return result;
        } catch (error) {
            throw new Error(`Failed to list workflows: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    /**
     * Execute a specific workflow by ID
     */
    executeWorkflow: async (workflowId: string, config: { hubUrl: string, apiSecretKey: string, executeWorkflowFn: Function }) => {
        try {
            // First, get the workflow details
            const workflowResponse = await fetch(`${config.hubUrl}/workflows/${workflowId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sashi-api-token': config.apiSecretKey
                }
            });

            if (!workflowResponse.ok) {
                throw new Error(`Workflow '${workflowId}' not found. Use listWorkflows() to see available workflows.`);
            }

            const workflowData = await workflowResponse.json();
            const workflow = workflowData.workflow;

            if (!workflow || !workflow.actions) {
                throw new Error(`Invalid workflow format for '${workflowId}'`);
            }

            // Execute the workflow using the provided function
            const result = await config.executeWorkflowFn(workflow, false); // workflow, debug

            // Format execution results as text
            return LinearSashiAgentTools.formatWorkflowResults(workflowData.name || workflowId, result);

        } catch (error) {
            throw new Error(`Failed to execute workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    /**
     * Get GitHub integration status
     */
    getGitHubStatus: (config?: GitHubConfig) => {
        const githubValidation = validateGitHubConfig(config);

        let result = "**GitHub Integration Status**\n\n";
        result += `Status: ${githubValidation.isValid ? '✅ Connected' : '❌ Not Connected'}\n`;
        result += `Configuration: ${githubValidation.status}\n\n`;

        if (githubValidation.isValid && config) {
            result += "**Current Configuration:**\n";
            result += `- Repository: ${config.owner}/${config.repo}\n`;
            result += `- Token: ${config.token ? 'Configured' : 'Missing'}\n`;
        } else {
            result += "**Missing Configuration:**\n";
            githubValidation.missingFields.forEach(field => {
                result += `- ${field}\n`;
            });
            result += "\n**To configure GitHub:**\n";
            result += "1. Get a GitHub personal access token\n";
            result += "2. Configure it in your Sashi settings with repository owner and name\n";
        }

        return result;
    },

    /**
     * Get GitHub repository details
     */
    getGitHubRepoInfo: async (config?: GitHubConfig) => {
        const githubValidation = validateGitHubConfig(config);

        if (!githubValidation.isValid) {
            throw new Error("GitHub is not configured. Use getGitHubStatus() to see configuration requirements.");
        }

        try {
            const githubService = await initializeGitHubAPI({
                token: config!.token,
                owner: config!.owner,
                repo: config!.repo
            });

            const repoData = await githubService.testConnection();

            let result = "**Connected Repository Details**\n\n";
            result += `**${repoData.full_name}**\n`;
            if (repoData.description) result += `${repoData.description}\n\n`;

            result += `- **URL:** ${repoData.html_url}\n`;
            result += `- **Language:** ${repoData.language || 'Not specified'}\n`;
            result += `- **Default Branch:** ${repoData.default_branch}\n`;
            result += `- **Visibility:** ${repoData.private ? 'Private' : 'Public'}\n`;
            result += `- **Stars:** ${repoData.stargazers_count}\n`;
            result += `- **Forks:** ${repoData.forks_count}\n`;
            result += `- **Open Issues:** ${repoData.open_issues_count}\n`;
            result += `- **Size:** ${Math.round(repoData.size / 1024)} MB\n`;
            result += `- **Created:** ${new Date(repoData.created_at).toLocaleDateString()}\n`;
            result += `- **Last Updated:** ${new Date(repoData.updated_at).toLocaleDateString()}\n`;

            if (repoData.topics && repoData.topics.length > 0) {
                result += `- **Topics:** ${repoData.topics.join(', ')}\n`;
            }

            if (repoData.license) {
                result += `- **License:** ${repoData.license.name}\n`;
            }

            return result;
        } catch (error) {
            throw new Error(`Failed to fetch repository details: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    /**
     * Format workflow execution results as readable text
     */
    formatWorkflowResults: (workflowName: string, result: any): string => {
        let output = `**Workflow '${workflowName}' executed successfully!**\n\n`;

        if (result.success && result.results) {
            output += "**Results:**\n\n";

            result.results.forEach((actionResult: any, index: number) => {
                output += `**Step ${index + 1}:** ${actionResult.uiElement?.content?.title || 'Action'}\n`;

                if (actionResult.result) {
                    // Format the result data as readable text
                    const data = actionResult.result;

                    if (typeof data === 'object' && data !== null) {
                        if (Array.isArray(data)) {
                            output += `Found ${data.length} items:\n`;
                            data.slice(0, 5).forEach((item: any, i: number) => {
                                output += `  ${i + 1}. ${LinearSashiAgentTools.formatDataItem(item)}\n`;
                            });
                            if (data.length > 5) {
                                output += `  ... and ${data.length - 5} more items\n`;
                            }
                        } else {
                            Object.entries(data).forEach(([key, value]) => {
                                if (key !== 'error' && key !== 'failed') {
                                    output += `  ${key}: ${LinearSashiAgentTools.formatValue(value)}\n`;
                                }
                            });
                        }
                    } else {
                        output += `  Result: ${data}\n`;
                    }
                }

                output += "\n";
            });
        }

        if (result.errors && result.errors.length > 0) {
            output += "**Errors encountered:**\n";
            result.errors.forEach((error: any) => {
                output += `- ${error.actionId}: ${error.error}\n`;
            });
            output += "\n";
        }

        return output;
    },

    /**
     * Format individual data items for display
     */
    formatDataItem: (item: any): string => {
        if (typeof item === 'string') return item;
        if (typeof item === 'number') return item.toString();
        if (typeof item === 'object' && item !== null) {
            // Try to find a meaningful identifier
            const id = item.id || item.name || item.title || item.email || item.username;
            if (id) return `${id}`;

            // Otherwise show first few fields
            const entries = Object.entries(item).slice(0, 2);
            return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
        }
        return String(item);
    },

    /**
     * Format values for display
     */
    formatValue: (value: any): string => {
        if (value === null || value === undefined) return 'N/A';
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (Array.isArray(value)) return `[${value.length} items]`;
        if (typeof value === 'object') return '[Object]';
        return String(value);
    }
};

/**
 * Linear Sashi Agent - follows the Linear agent pattern with THINKING/ACTION/RESPONSE
 */
export class LinearSashiAgent {
    private config?: GitHubConfig;
    private hubUrl?: string;
    private apiSecretKey?: string;
    private executeWorkflowFn?: Function;
    private maxIterations: number = 10;

    constructor(config?: { githubConfig?: GitHubConfig, hubUrl?: string, apiSecretKey?: string, executeWorkflowFn?: Function }) {
        this.config = config?.githubConfig;
        this.hubUrl = config?.hubUrl;
        this.apiSecretKey = config?.apiSecretKey;
        this.executeWorkflowFn = config?.executeWorkflowFn;
    }

    /**
     * Get the agent prompt for Linear
     */
    getPrompt(): string {
        const githubStatus = this.config ?
            `GitHub is configured for repository ${this.config.owner}/${this.config.repo}` :
            'GitHub is not configured';

        return `You're a helpful Sashi assistant that can manage workflows and GitHub integration. You must respond with EXACTLY ONE activity type per cycle.

CRITICAL: You can only emit ONE of these per response - never combine them:

THINKING: Use this for observations, chain of thought, or analysis
ACTION: Use this to call one of the available tools (will be executed in two parts)
ELICITATION: Use this to ask the user for more information (will end your turn)
RESPONSE: Use this for final responses when the task is complete (will end your turn)
ERROR: Use this to report errors, like if a tool fails (will end your turn)

Available tools:
- listWorkflows(): Get all saved workflows
- executeWorkflow(workflow_id): Execute a specific workflow by ID
- getGitHubStatus(): Check GitHub integration status
- getGitHubRepoInfo(): Get details about connected repository

Current Status:
- ${githubStatus}
- Hub URL: ${this.hubUrl ? 'Configured' : 'Not configured'}
- Execute Function: ${this.executeWorkflowFn ? 'Configured' : 'Not configured'}

IMPORTANT CONTEXT HANDLING:
- If the user asks about workflows, use listWorkflows() first to see what's available
- If they want to run a workflow, use executeWorkflow(workflow_id) with the specific ID
- If they ask about GitHub, use getGitHubStatus() or getGitHubRepoInfo() as appropriate
- Use conversation history to understand context and previous requests

RESPONSE FORMAT RULES:
1. Start with exactly ONE activity type
2. NEVER combine multiple activity types in a single response
3. Each response must be complete and standalone

For ACTION responses:
- Format: ACTION: tool_name(parameter)
- Example: ACTION: listWorkflows()
- Example: ACTION: executeWorkflow("workflow-123")
- Example: ACTION: getGitHubStatus()
- The system will handle the two-part execution automatically

Examples of correct responses:
- "THINKING: The user is asking for their workflows. I need to list them first"
- "ACTION: listWorkflows()"
- "RESPONSE: Here are your workflows: [workflow details]"
- "ACTION: executeWorkflow("user-notification")"
- "ELICITATION: Which workflow would you like me to run? Please provide the workflow ID."
- "ERROR: The tool failed to execute"
- "RESPONSE: I can help you with workflows and GitHub integration. Use 'list workflows' to see your saved workflows."

FOLLOW-UP QUESTION EXAMPLES:
- User: "Run the user notification workflow" → THINKING: Need to find the workflow, then ACTION: listWorkflows()
- User: "What's my GitHub status?" → ACTION: getGitHubStatus()
- User: "Show me my workflows" → ACTION: listWorkflows()

NEVER do this (multiple activities in one response):
- "THINKING: I need workflows. ACTION: listWorkflows()"

Your first iteration must be a THINKING statement to acknowledge the user's prompt, like:
- "THINKING: The user wants to see their workflows. I'll list them."
- "THINKING: The user wants to run a workflow. I need to check what workflows are available first."

If the user asks about your capabilities, provide a RESPONSE listing the available tools and what you can do.

Always emit exactly ONE activity type per cycle.`;
    }

    /**
     * Process a user request using the Linear agent pattern
     */
    async handleUserPrompt(userPrompt: string, previousActivities: Array<{ role: string, content: string }> = []): Promise<string> {
        if (!this.hubUrl || !this.apiSecretKey) {
            return "ERROR: Configuration incomplete. Need hubUrl and apiSecretKey to access workflows and perform operations.";
        }

        // Build conversation context
        const messages = [
            { role: 'system', content: this.getPrompt() },
            ...previousActivities,
            { role: 'user', content: userPrompt }
        ];

        let taskComplete = false;
        let iterations = 0;
        let currentResponse = '';

        while (!taskComplete && iterations < this.maxIterations) {
            iterations++;

            try {
                // Analyze the user's request and generate appropriate response
                const response = await this.generateResponse(messages);
                currentResponse = response;

                if (response.startsWith('THINKING:')) {
                    // Add to conversation and continue
                    messages.push({ role: 'assistant', content: response });
                    // Continue the loop for next cycle
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } else if (response.startsWith('ACTION:')) {
                    // Parse and execute action
                    const actionMatch = response.match(/ACTION:\s*(\w+)\(([^)]*)\)/);
                    if (actionMatch && actionMatch[1]) {
                        const toolName = actionMatch[1];
                        const params = actionMatch[2] || '';

                        try {
                            const toolResult = await this.executeAction(toolName, params);

                            // Add action and result to conversation
                            messages.push({ role: 'assistant', content: response });
                            messages.push({ role: 'user', content: `Tool result: ${toolResult}` });

                            // Continue the loop for next cycle
                            await new Promise(resolve => setTimeout(resolve, 1000));

                        } catch (error) {
                            return `ERROR: Failed to execute ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                        }
                    } else {
                        return `ERROR: Invalid action format: ${response}`;
                    }

                } else if (response.startsWith('RESPONSE:') || response.startsWith('ELICITATION:') || response.startsWith('ERROR:')) {
                    taskComplete = true;

                } else {
                    // Fallback - treat as response
                    taskComplete = true;
                    currentResponse = `RESPONSE: ${response}`;
                }

            } catch (error) {
                return `ERROR: ${error instanceof Error ? error.message : 'An unknown error occurred'}`;
            }
        }

        if (!taskComplete && iterations >= this.maxIterations) {
            return "ERROR: Maximum iterations reached. The task could not be completed.";
        }

        return currentResponse;
    }

    /**
     * Generate a response based on the conversation context
     */
    private async generateResponse(messages: Array<{ role: string, content: string }>): Promise<string> {
        const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
        const lowerMessage = lastUserMessage.toLowerCase();

        // Simple intent analysis for demonstration
        if (lowerMessage.includes('list') || lowerMessage.includes('show') || lowerMessage.includes('workflows')) {
            if (messages.length <= 2) { // First interaction
                return "THINKING: The user wants to see their workflows. I'll list them.";
            } else {
                return "ACTION: listWorkflows()";
            }
        }

        if (lowerMessage.includes('run') || lowerMessage.includes('execute')) {
            // Try to extract workflow ID
            const workflowMatch = lastUserMessage.match(/workflow[:\s]+([a-zA-Z0-9\-_]+)/i) ||
                lastUserMessage.match(/["']([^"']+)["']/);

            if (workflowMatch) {
                const workflowId = workflowMatch[1];
                return `ACTION: executeWorkflow("${workflowId}")`;
            } else {
                return "ELICITATION: Which workflow would you like me to run? Please provide the workflow ID or name. You can say 'list workflows' to see all available workflows.";
            }
        }

        if (lowerMessage.includes('github status') || lowerMessage.includes('github config')) {
            return "ACTION: getGitHubStatus()";
        }

        if (lowerMessage.includes('repo details') || lowerMessage.includes('repository info')) {
            return "ACTION: getGitHubRepoInfo()";
        }

        if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
            return "RESPONSE: I can help you with:\n\n**Workflows:**\n- List your saved workflows\n- Execute workflows by ID\n\n**GitHub Integration:**\n- Check GitHub connection status\n- Get repository details\n\n**Commands:**\n- 'list workflows' - Show all saved workflows\n- 'run workflow [id]' - Execute a specific workflow\n- 'github status' - Check GitHub integration\n- 'repo details' - Show repository information\n\nTry saying 'list workflows' to get started!";
        }

        // Default response for unknown requests
        return "RESPONSE: I can help you manage workflows and check GitHub integration. Try saying:\n- 'list workflows' to see your saved workflows\n- 'github status' to check GitHub connection\n- 'help' for more information";
    }

    /**
     * Execute a tool action
     */
    private async executeAction(toolName: string, params: string): Promise<string> {
        const config = {
            hubUrl: this.hubUrl!,
            apiSecretKey: this.apiSecretKey!,
            executeWorkflowFn: this.executeWorkflowFn!
        };

        switch (toolName) {
            case 'listWorkflows':
                return await LinearSashiAgentTools.listWorkflows(config);

            case 'executeWorkflow':
                const workflowId = params.replace(/['"]/g, '').trim();
                return await LinearSashiAgentTools.executeWorkflow(workflowId, config);

            case 'getGitHubStatus':
                return LinearSashiAgentTools.getGitHubStatus(this.config);

            case 'getGitHubRepoInfo':
                return await LinearSashiAgentTools.getGitHubRepoInfo(this.config);

            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
}


// Export a singleton instance for Linear agent
let linearSashiAgent: LinearSashiAgent | null = null;

export const getLinearSashiAgent = (config?: { githubConfig?: GitHubConfig, hubUrl?: string, apiSecretKey?: string, executeWorkflowFn?: Function }): LinearSashiAgent => {
    if (!linearSashiAgent) {
        linearSashiAgent = new LinearSashiAgent(config);
    }
    return linearSashiAgent;
};

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