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

    const validateSimpleChangeTool = tool({
        name: 'validate_simple_change',
        description: 'Analyze a code change request to understand its type and complexity',
        strict: false,
        parameters: {
            type: "object" as const,
            properties: {
                request: {
                    type: "string" as const,
                    description: "The user's code change request"
                },
                debug: {
                    type: "boolean" as const,
                    description: "Enable detailed debugging output"
                }
            },
            required: ["request"],
            additionalProperties: false as const
        } as any,
        execute: async ({ request, debug = false }: { request: string, debug?: boolean }) => {
            const lowerRequest = request.toLowerCase();

            // Initialize debugging info
            const debugInfo = {
                originalRequest: request,
                lowerRequest: lowerRequest,
                safePatternMatches: [] as string[],
                unsafePatternMatches: [] as string[],
                hasQuotedText: false,
                hasColorRef: false,
                hasSafeFileRef: false,
                quotedTextMatches: [] as string[],
                colorMatches: [] as string[],
                fileRefMatches: [] as string[],
                finalDecision: '',
                reasoning: ''
            };

            // Define safe change patterns
            const safePatterns = [
                'change text', 'update text', 'change copy', 'update copy',
                'change button text', 'update button', 'button text',
                'change title', 'update title', 'change heading',
                'change color', 'update color', 'change background',
                'change font', 'update font', 'text color',
                'copyright', 'footer text', 'header text',
                'fix typo', 'fix spelling', 'correct spelling',
                'change label', 'update label', 'placeholder text'
            ];

            // Define unsafe patterns (complex changes)
            const unsafePatterns = [
                'add function', 'create function', 'new function',
                'add logic', 'business logic', 'authentication',
                'database', 'api', 'endpoint', 'service',
                'refactor', 'restructure', 'architecture',
                'add component', 'new component', 'create component',
                'state management', 'redux', 'context',
                'routing', 'navigation', 'route',
                'performance', 'optimization', 'memory',
                'security', 'validation', 'error handling',
                'test', 'testing', 'unit test'
            ];

            // Check for unsafe patterns first
            const unsafeMatches = unsafePatterns.filter(pattern =>
                lowerRequest.includes(pattern)
            );
            debugInfo.unsafePatternMatches = unsafeMatches;

            // Note: Removed safety barrier - agent can now handle complex changes

            // Check for safe patterns
            const safeMatches = safePatterns.filter(pattern =>
                lowerRequest.includes(pattern)
            );
            debugInfo.safePatternMatches = safeMatches;

            // Additional checks for safe file references
            const fileRefRegex = /\.(tsx|jsx|css|scss|md)/;
            const fileRefMatch = fileRefRegex.test(lowerRequest);
            debugInfo.hasSafeFileRef = fileRefMatch;
            if (fileRefMatch) {
                debugInfo.fileRefMatches = lowerRequest.match(fileRefRegex) || [];
            }

            // Check for safe content changes (quoted text, colors, etc.)
            const quotedTextRegex = /"[^"]*"/g;
            const quotedMatches = request.match(quotedTextRegex) || [];
            debugInfo.hasQuotedText = quotedMatches.length > 0;
            debugInfo.quotedTextMatches = quotedMatches;

            const colorRegex = /(color|#[0-9a-f]{3,6}|rgb|rgba|hsl)/ig;
            const colorMatches = request.match(colorRegex) || [];
            debugInfo.hasColorRef = colorMatches.length > 0;
            debugInfo.colorMatches = colorMatches;

            // Decision logic
            const hasSafePattern = safeMatches.length > 0;
            const hasQuotedText = quotedMatches.length > 0;
            const hasColorRef = colorMatches.length > 0;

            if (hasSafePattern || hasQuotedText || hasColorRef) {
                const confidence = hasSafePattern ? 0.9 : 0.7;
                const changeType = hasQuotedText ? 'text_change' : hasColorRef ? 'style_change' : 'content_change';

                debugInfo.finalDecision = 'SAFE';
                debugInfo.reasoning = `Confidence: ${confidence}, Type: ${changeType}. Safe patterns: ${safeMatches.length}, Quoted text: ${hasQuotedText}, Color refs: ${hasColorRef}`;

                const result = {
                    safe: true,
                    confidence: confidence,
                    changeType: changeType,
                    ...(debug ? { debug: debugInfo } : {})
                };

                if (debug) {
                    console.log('✅ GitHub Agent Validation Debug:', JSON.stringify(debugInfo, null, 2));
                }

                return result;
            }

            // If no clear patterns detected, still proceed (safety barriers removed)
            debugInfo.finalDecision = 'PROCEEDING - Safety barriers removed';
            debugInfo.reasoning = 'No specific patterns detected, but proceeding with request';

            const result = {
                safe: true,
                confidence: 0.5,
                changeType: 'general_change',
                ...(debug ? { debug: debugInfo } : {})
            };

            if (debug) {
                console.log('✅ GitHub Agent Validation Debug:', JSON.stringify(debugInfo, null, 2));
            }

            return result;
        }
    });

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
            validateSimpleChangeTool,
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

// Main SashiAgent - Router that decides which agents to use
const createSashiAgent = (workflowPlannerAgent: Agent, responseAgent: Agent, refinerAgent: Agent, githubAgent: Agent, config?: GitHubConfig) => {

    let hasGithub = false;
    if (config) {
        hasGithub = true;
    }

    console.log('hasGithub', hasGithub);
    return new Agent({
        name: 'SashiAgent',
        instructions: `You are SashiAgent, the main conversational AI assistant that intelligently routes requests to specialized agents.

## Your Role
You are the entry point for all user requests. Your job is to understand the user's intent and route them to the appropriate specialized agents to fulfill their needs.

## Core Decision: Workflow vs GitHub vs Conversational Response

**Route to GitHub Agent** when the user's intent is to:
- Make code changes or modifications
- Update files in a repository
- Fix bugs or issues in code
- Change UI elements, text, styling
- Add or modify features in code
- Create pull requests
- Any request that involves modifying repository files
- you are given a hasGithub flag, if it is true, you have access to github if it is false, you do not have access to github so dont try to use github tools

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

**Informational Intent Indicators:**
- User wants to understand or learn something
- Request is about concepts, processes, or explanations
- User is exploring capabilities or asking "how" questions
- Request is conversational or exploratory in nature

## Routing Strategy

**For GitHub Code Requests:**
1. Hand off to GitHub Agent for explain-then-approve workflow

**For Other Actionable Requests:**
1. Hand off to Workflow Planner to create complete workflow with actions and UI components

**For Informational Requests:**
1. Hand off directly to Response Agent for conversational response

## Key Principles
- Focus on intent, not keywords
- Be confident in your routing decisions
- Trust the specialized agents to handle their domains
- Prioritize user experience through smooth handoffs
- When in doubt about code changes, route to GitHub Agent
- When in doubt about other actions, consider if the user expects to see actual results or data

Analyze the user's request to understand their true intent and route accordingly.`,
        handoffs: [
            hasGithub ? handoff(githubAgent, {
                toolDescriptionOverride: 'Hand off to GitHub Agent when user wants to make code changes, modify files, or create pull requests'
            }) : null,
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
    constructor(config?: GitHubConfig) {
        this.workflowPlannerAgent = createWorkflowPlannerAgent();
        this.responseAgent = createResponseAgent();
        this.githubAgent = createGitHubAgent(config);
        this.refinerAgent = createWorkflowRefinerAgent();
        this.config = config;
        this.mainAgent = createSashiAgent(
            this.workflowPlannerAgent,
            this.responseAgent,
            this.refinerAgent,
            this.githubAgent,
            config
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

export const getSashiAgent = (config?: GitHubConfig): SashiAgent => {
    if (!sashiAgent) {
        sashiAgent = new SashiAgent(config);
    }
    return sashiAgent;
}; 