import bodyParser from "body-parser"
import chalk from 'chalk'
import cors from "cors"
import { NextFunction, Request, Response, Router } from "express"

import {
    AIArray,
    AIFieldEnum,
    AIObject,
    callFunctionFromRegistryFromObject,
    getFunctionAttributes,
    getFunctionRegistry,
    toggleFunctionActive
} from "./ai-function-loader"
import { createAIBot, getAIBot } from "./aibot"

import { processChatRequest } from "./chat"
import { GeneralResponse, WorkflowResponse } from "./models/models"
import { MetaData } from "./models/repo-metadata"
import { createWorkflowExecutionError, createWorkflowExecutionSuccess, WorkflowResult as NewWorkflowResult } from './types/workflow'
import { createSashiHtml, createSessionToken, ensureUrlProtocol } from './utils'
import { createWorkflowErrorRecovery } from './workflow-error-recovery'


const HEADER_API_TOKEN = 'x-api-token';
const HEADER_SESSION_TOKEN = 'x-sashi-session-token';

const Sentry = require("@sentry/node");

Sentry.init({
    dsn: 'https://81e05c5cf10d2ec20ef0ab944853ec79@o4508301271105536.ingest.us.sentry.io/4508301273726976', // Replace with your actual DSN
    // Optional configurations
});

const asyncHandler = (fn: (req: Request, res: Response, next?: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
        Sentry.captureException(err);
        next(err);
    });
};


export const validateRepoRequest = ({ sashiServerUrl, sashiHubUrl }: {
    sashiServerUrl?: string
    sashiHubUrl?: string
}) => {

    return (req: Request, res: Response, next: NextFunction) => {
        const origin = req.headers.origin;
        let currentUrl = sashiServerUrl ?? req.get('host') ?? '';
        try {
            let originHostname = '';
            if (origin) {
                try {
                    const originUrl = new URL(origin);
                    originHostname = originUrl.hostname;
                } catch (err) {
                    Sentry.captureException(err);
                    console.error('Invalid origin:', err);
                    // Handle invalid origin
                    return res.status(403).json({ error: 'Invalid origin' });
                }
            }

            if (!currentUrl || typeof currentUrl !== 'string') {
                currentUrl = 'localhost';
            }

            let currentUrlObj: URL;
            try {
                currentUrlObj = new URL(`http://${currentUrl}`);
            } catch (err) {
                Sentry.captureException(err);
                console.error('Invalid currentUrl:', err);
                currentUrlObj = new URL('http://localhost');
            }

            Sentry.addBreadcrumb({
                category: "validation",
                message: `origin: ${origin}, currentUrl: ${currentUrl}`,
                level: "info",
            });

            const isLocalhost =
                originHostname === 'localhost' &&
                currentUrlObj.hostname === 'localhost';
            const isSameDomain = !origin || originHostname === currentUrlObj.hostname;
            const isFromHub = sashiHubUrl && req.headers[HEADER_API_TOKEN] === sashiHubUrl;

            Sentry.addBreadcrumb({
                category: "validation",
                message: `isLocalhost: ${isLocalhost}, isSameDomain: ${isSameDomain}`,
                level: "info",
            });

            if (!isLocalhost && !isSameDomain && !isFromHub) {

                Sentry.addBreadcrumb({
                    category: "validation",
                    message: `Unauthorized request`,
                    level: "error",
                });
                Sentry.captureException(new Error('Unauthorized request'));
                return res
                    .status(403)
                    .json({ error: 'Unauthorized request' });

            }

            // If authorized, proceed to the next middleware
            next();
        } catch (err) {
            Sentry.captureException(err);
            console.error('Error parsing URLs:', err);
            return res.status(403).json({ error: 'Invalid origin or URL' });
        }
    }
};




interface MiddlewareOptions {
    openAIKey: string
    debug?: boolean
    repos?: string[]
    sashiServerUrl?: string //where the sashi server is hosted if you can't find it automatically
    apiSecretKey?: string // used to validate requests from and to the hub
    hubUrl?: string // hub where all the repos are hosted
    langFuseInfo?: {
        publicKey: string
        secretKey: string
        baseUrl: string
    }
    getSession?: (req: Request, res: Response) => Promise<string> // function to get the session id for a request
    validateSession?: (sessionToken: string, req: Request, res: Response) => Promise<boolean> // function to validate session tokens
    sessionSecret?: string // secret for signing/validating session tokens
}

export interface DatabaseClient {
    query: (operation: string, details: any) => Promise<any>;
}

const checkOpenAI = async (): Promise<boolean> => {
    try {
        const aibot = getAIBot();
        await aibot.chatCompletion({
            messages: [{ role: 'user', content: 'test' }],
            temperature: 0
        });
        return true;
    } catch (error) {
        return false;
    }
};

const checkHubConnection = async (hubUrl: string, apiSecretKey?: string): Promise<boolean> => {
    try {
        const response = await fetch(`${hubUrl}/ping`, {
            headers: apiSecretKey ? {
                [HEADER_API_TOKEN]: apiSecretKey,
            } : undefined,
        });
        return response.status === 200;
    } catch (error) {
        return false;
    }
};

const printStatus = (message: string, status: boolean | 'loading' = true) => {
    let statusText;
    if (status === 'loading') {
        statusText = chalk.yellow('⟳');
    } else {
        statusText = status ? chalk.green('✓') : chalk.red('✗');
    }
    console.log(`${statusText} ${message}`);
};


export const createMiddleware = (options: MiddlewareOptions) => {
    const {
        openAIKey,
        debug = false,
        sashiServerUrl: rawSashiServerUrl,
        apiSecretKey,
        repos = [],
        hubUrl: rawHubUrl = 'https://hub.usesashi.com',
        getSession,
        validateSession,
        sessionSecret
    } = options

    // Ensure URLs have proper protocols
    const sashiServerUrl = rawSashiServerUrl ? ensureUrlProtocol(rawSashiServerUrl) : undefined;
    const hubUrl = ensureUrlProtocol(rawHubUrl);

    const router = Router();

    // Allow all origins and headers for dev/testing
    router.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'x-api-token', 'x-sashi-session-token'],
    }));

    // Handle preflight requests
    router.options('*', cors());

    createAIBot({ apiKey: openAIKey, sashiSecretKey: apiSecretKey, hubUrl })

    async function checkSetup(debug: boolean) {
        console.log('\n🔍 Sashi Middleware Status Check\n')

        // Show loading states
        printStatus('Checking OpenAI connection...', 'loading')
        printStatus('Checking Hub connection...', 'loading')

        try {
            // Run both checks in parallel
            const [openAIConnected, hubConnected] = await Promise.all([
                checkOpenAI(),
                checkHubConnection(hubUrl, apiSecretKey)
            ])

            // Clear the loading states
            process.stdout.write('\x1b[2A') // Move up two lines
            process.stdout.write('\x1b[2K') // Clear first line
            process.stdout.write('\x1b[1A') // Move up one more line
            process.stdout.write('\x1b[2K') // Clear second line

            // Show individual success/failure messages
            printStatus('OpenAI connection', openAIConnected)
            printStatus(`Hub connection (${hubUrl})`, hubConnected)

            // Show the remaining statuses
            const functionRegistry = getFunctionRegistry();
            const functionCount = functionRegistry.size;
            printStatus(`Registered functions (${functionCount})`, functionCount > 0);

            // Check middleware configuration
            printStatus('Middleware configuration', true)

            let detectedUrl = sashiServerUrl;



            if (!detectedUrl) {
                detectedUrl = `http://localhost:${process.env.PORT || 3000}/sashi`;
            }


            console.log(`  • Server URL: ${detectedUrl}`);
            console.log(`  • Debug: ${debug}`)
            console.log(`  • Session Management: ${getSession ? 'Custom' : 'Default'}\n`)
        } catch (error) {
            console.error('Error during status checks:', error)
            // Clear loading states and show error
            process.stdout.write('\x1b[2A')
            process.stdout.write('\x1b[2K')
            process.stdout.write('\x1b[1A')
            process.stdout.write('\x1b[2K')
            printStatus('OpenAI connection', false)
            printStatus('Hub connection', false)
        }
    }

    checkSetup(debug)




    // Fetch metadata during middleware initialization
    router.use(cors());
    router.use(bodyParser.json());
    router.use(bodyParser.urlencoded({ extended: true }));

    // Create session validation middleware instance
    const sessionValidation = validateSessionRequest({
        getSession,
        validateSession,
        sessionSecret
    });

    router.get('/sanity-check', (_req, res) => {
        res.json({ message: 'Sashi Middleware is running' });
        return;
    });

    router.get('/ping', (_req, res) => {
        const apiToken = _req.headers[HEADER_API_TOKEN] as string;
        if (apiToken !== apiSecretKey) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        res.status(200).json({ token: apiToken, message: 'Sashi Middleware is running' });
        return;
    });



    router.get('/metadata', validateRepoRequest({ sashiServerUrl, sashiHubUrl: hubUrl }), asyncHandler(async (_req, res, next) => {
        const metadata: MetaData = {
            hubUrl: hubUrl,
            functions: Array.from(getFunctionRegistry().values())
                .filter(func => {
                    const functionAttribute = getFunctionAttributes().get(func.getName());
                    // Filter out hidden functions from UI metadata (but they're still available in tools schema)
                    return !functionAttribute?.isHidden;
                })
                .map((func) => {
                    const functionAttribute = getFunctionAttributes().get(
                        func.getName()
                    );

                    return {
                        name: func.getName(),
                        description: func.getDescription(),
                        needConfirmation: func.getNeedsConfirm(),
                        active: functionAttribute?.active ?? true,
                        isVisualization: false,
                    };
                }),
        };
        return res.json(metadata);
    }))

    router.get('/check_hub_connection', async (_req, res) => {
        try {
            const connectedData = await fetch(`${hubUrl}/ping`, {
                headers: apiSecretKey ? {
                    [HEADER_API_TOKEN]: apiSecretKey,
                } : undefined,
            });
            res.json({ connected: connectedData.status === 200 });
        } catch (error) {
            res.json({ connected: false });
        }
    });





    // =============== WORKFLOW ENDPOINTS ===============

    // Helper to forward workflow requests to hub if available, or handle locally
    const handleWorkflowRequest = async (req: Request, res: Response, hubPath: string, method: string) => {
        // Get session token from request
        const sessionToken = req.headers['x-session-token'] as string;
        let sessionId = sessionToken;

        // If getSession is provided, use it to get the session ID
        if (getSession) {
            try {
                sessionId = await getSession(req, res);
            } catch (error) {
                console.error('Error getting session ID:', error);
                return res.status(401).json({
                    error: 'Authentication failed',
                    details: 'Unable to retrieve session information. Please check your authentication setup.',
                    code: 'SESSION_ERROR'
                });
            }
        }

        // Check if hub configuration is available
        if (!hubUrl || !apiSecretKey) {
            console.error('Hub configuration missing:', { hubUrl: !!hubUrl, apiSecretKey: !!apiSecretKey });
            return res.status(500).json({
                error: 'Hub server not configured',
                details: 'Missing hub URL or API secret key. Please check your server configuration.',
                code: 'HUB_CONFIG_MISSING'
            });
        }

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                [HEADER_API_TOKEN]: apiSecretKey,
            };

            // Add session ID if available
            if (sessionId) {
                headers['X-Session-ID'] = sessionId;
            }

            // Prepare the request options
            const fetchOptions: RequestInit = {
                method,
                headers,
                // Add timeout to prevent hanging requests
                signal: AbortSignal.timeout(30000), // 30 second timeout
            };

            // Add request body for POST/PUT requests
            if (method === 'POST' || method === 'PUT') {
                fetchOptions.body = JSON.stringify(req.body);
            }

            // Make the request to the hub
            const hubResponse = await fetch(`${hubUrl}${hubPath}`, fetchOptions);

            // If request was successful, return the response
            if (hubResponse.ok) {
                // For GET requests, return the JSON data
                if (method === 'GET') {
                    const data = await hubResponse.json();
                    return res.json(data);
                }

                // For other methods, return success status
                const data = await hubResponse.json();
                return res.status(hubResponse.status).json(data);
            }

            // Hub request failed - provide specific error based on status code
            let errorMessage = 'Hub server request failed';
            let errorDetails = `Server returned ${hubResponse.status} ${hubResponse.statusText}`;
            let errorCode = 'HUB_REQUEST_FAILED';

            if (hubResponse.status === 401) {
                errorMessage = 'Hub authentication failed';
                errorDetails = 'Invalid API credentials. Please check your API secret key.';
                errorCode = 'HUB_AUTH_FAILED';
            } else if (hubResponse.status === 403) {
                errorMessage = 'Hub access forbidden';
                errorDetails = 'Access denied to hub resource. Check your permissions.';
                errorCode = 'HUB_ACCESS_DENIED';
            } else if (hubResponse.status === 404) {
                errorMessage = 'Hub endpoint not found';
                errorDetails = `The requested endpoint '${hubPath}' was not found on the hub server.`;
                errorCode = 'HUB_ENDPOINT_NOT_FOUND';
            } else if (hubResponse.status === 429) {
                errorMessage = 'Hub rate limit exceeded';
                errorDetails = 'Too many requests to hub server. Please try again later.';
                errorCode = 'HUB_RATE_LIMITED';
            } else if (hubResponse.status >= 500) {
                errorMessage = 'Hub server error';
                errorDetails = `Hub server is experiencing issues (${hubResponse.status}). Please try again later.`;
                errorCode = 'HUB_SERVER_ERROR';
            }

            console.warn(`Hub request failed for ${hubPath}:`, {
                status: hubResponse.status,
                statusText: hubResponse.statusText,
                url: `${hubUrl}${hubPath}`
            });

            return res.status(hubResponse.status).json({
                error: errorMessage,
                details: errorDetails,
                code: errorCode
            });

        } catch (error: any) {
            console.error(`Error forwarding workflow request to hub (${hubPath}):`, error);

            // Categorize different types of errors
            let errorMessage = 'Hub connection failed';
            let errorDetails = 'Unable to connect to hub server';
            let errorCode = 'HUB_CONNECTION_ERROR';
            let statusCode = 503;

            if (error.name === 'AbortError' || error.message?.includes('timeout')) {
                errorMessage = 'Hub request timeout';
                errorDetails = 'Request to hub server timed out after 30 seconds. The server may be overloaded.';
                errorCode = 'HUB_TIMEOUT';
                statusCode = 408;
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Hub server unavailable';
                errorDetails = `Cannot connect to hub server at ${hubUrl}. The server may be down.`;
                errorCode = 'HUB_CONNECTION_REFUSED';
                statusCode = 503;
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = 'Hub server not found';
                errorDetails = `Cannot resolve hub server hostname: ${hubUrl}. Please check the URL.`;
                errorCode = 'HUB_DNS_ERROR';
                statusCode = 503;
            } else if (error.code === 'ETIMEDOUT') {
                errorMessage = 'Hub network timeout';
                errorDetails = 'Network timeout while connecting to hub server.';
                errorCode = 'HUB_NETWORK_TIMEOUT';
                statusCode = 408;
            } else if (error.message?.includes('Invalid URL')) {
                errorMessage = 'Invalid hub URL';
                errorDetails = `The configured hub URL is invalid: ${hubUrl}`;
                errorCode = 'HUB_INVALID_URL';
                statusCode = 500;
            }

            return res.status(statusCode).json({
                error: errorMessage,
                details: errorDetails,
                code: errorCode,
                hubUrl: hubUrl // Include for debugging
            });
        }
    };

    // Get all workflows
    router.get('/workflows', sessionValidation, asyncHandler(async (req, res) => {
        return handleWorkflowRequest(req, res, '/workflows', 'GET');
    }));

    // Get a specific workflow by ID
    router.get('/workflows/:id', sessionValidation, asyncHandler(async (req, res) => {
        return handleWorkflowRequest(req, res, `/workflows/${req.params.id}`, 'GET');
    }));

    // Create a new workflow
    router.post('/workflows', sessionValidation, asyncHandler(async (req, res) => {
        return handleWorkflowRequest(req, res, '/workflows', 'POST');
    }));

    // Update an existing workflow
    router.put('/workflows/:id', sessionValidation, asyncHandler(async (req, res) => {
        return handleWorkflowRequest(req, res, `/workflows/${req.params.id}`, 'PUT');
    }));

    // Delete a specific workflow
    router.delete('/workflows/:id', sessionValidation, asyncHandler(async (req, res) => {
        return handleWorkflowRequest(req, res, `/workflows/${req.params.id}`, 'DELETE');
    }));

    // Delete all workflows
    router.delete('/workflows', sessionValidation, asyncHandler(async (req, res) => {
        return handleWorkflowRequest(req, res, '/workflows', 'DELETE');
    }));

    router.get('/test-error', asyncHandler(async () => {
        throw new Error('Test error for Sentry');
    }));

    function guessUIType(result: any): 'card' | 'table' | 'badge' | 'text' | 'textarea' | 'graph' {
        // Handle null, undefined or primitive values as text
        if (result === null || result === undefined) {
            return 'text';
        }

        // Handle strings based on length and content
        if (typeof result === 'string') {
            // Check if it's a JSON string
            try {
                const parsed = JSON.parse(result);
                // If it's a JSON object or array with multiple items, use textarea
                if (typeof parsed === 'object' && parsed !== null) {
                    if (Array.isArray(parsed) && parsed.length > 1) {
                        return 'textarea';
                    }
                    // If it's an object with multiple keys or nested structure, use textarea
                    if (!Array.isArray(parsed) && Object.keys(parsed).length > 1) {
                        return 'textarea';
                    }
                    // Otherwise, use the type based on the parsed content
                    return guessUIType(parsed);
                }
            } catch (e) {
                // Not JSON, continue with other string checks
            }

            // Long text gets the text treatment
            if (result.length > 300) {
                return 'text';
            }

            return 'text';
        }

        // Check for large nested objects (should use textarea)
        if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
            const json = JSON.stringify(result);
            if (json.length > 300) {
                return 'textarea';
            }

            // Check if we have deeply nested objects
            const hasComplexNesting = (obj: any, depth: number = 0): boolean => {
                if (depth > 2) return true; // If nesting is deeper than 2 levels
                if (typeof obj !== 'object' || obj === null) return false;

                if (Array.isArray(obj)) {
                    return obj.some(item => typeof item === 'object' && item !== null && hasComplexNesting(item, depth + 1));
                }

                return Object.values(obj).some(val =>
                    typeof val === 'object' && val !== null && hasComplexNesting(val, depth + 1)
                );
            };

            if (hasComplexNesting(result)) {
                return 'textarea';
            }
        }

        // Check for arrays that could be table data
        if (Array.isArray(result)) {
            // Empty arrays are just text
            if (result.length === 0) {
                return 'text';
            }

            // Large arrays should be textareas
            if (result.length > 20) {
                return 'textarea';
            }

            // Check if it's an array of objects with consistent keys (table)
            if (result.every(item => typeof item === 'object' && item !== null)) {
                // Get all keys from the first item
                const firstItemKeys = Object.keys(result[0] || {});

                // If every item has at least some of these keys, it's likely a table
                if (firstItemKeys.length > 0 && result.length > 1) {
                    return 'table';
                }
            }

            // Check if it's an array of simple values (potential graph data)
            if (result.every(item =>
                typeof item === 'number' ||
                (typeof item === 'object' && item !== null && 'x' in item && 'y' in item)
            )) {
                return 'graph';
            }

            // Default arrays to card view
            return 'card';
        }

        // Check for graph data structure
        if (typeof result === 'object' && result !== null) {
            // Check for common graph data structures
            if (
                ('data' in result && Array.isArray(result.data)) ||
                ('datasets' in result && Array.isArray(result.datasets)) ||
                ('series' in result && Array.isArray(result.series))
            ) {
                return 'graph';
            }

            // Small objects (2-3 keys) are badges
            const keys = Object.keys(result);
            if (keys.length <= 3) {
                return 'badge';
            }

            // Check for nested structures (more complex objects)
            const hasNestedObjects = Object.values(result).some(
                val => typeof val === 'object' && val !== null
            );

            // Complex objects with nested data are cards
            if (hasNestedObjects) {
                return 'card';
            }
        }

        // Default to card for objects
        if (typeof result === 'object' && result !== null) {
            return 'card';
        }

        // Default for everything else
        return 'text';
    }

    // Function to enhance UI type determination with LLM
    async function enhanceOutputUIWithLLM(result: any, initialType: string, aibot: any): Promise<{
        type: 'card' | 'table' | 'badge' | 'text' | 'textarea' | 'graph';
        config?: Record<string, any>;
    }> {
        try {
            const stringifiedResult = typeof result === 'string'
                ? result
                : JSON.stringify(result, null, 2);

            const prompt = `
            You are an AI that specializes in data visualization and UI design.
            
            Analyze this data and determine the best way to display it in a UI:
            \`\`\`
            ${stringifiedResult}
            \`\`\`
            
            The system's initial guess is that this should be displayed as: ${initialType}
            
            Please provide a JSON response with:
            1. The best UI component type to use ('table', 'card', 'badge', 'text', 'textarea', or 'graph')
               - 'table' for tabular data with rows and columns
               - 'card' for object display with key-value pairs in a card format
               - 'badge' for simple key-value pairs
               - 'text' for plain text display
               - 'textarea' for complex JSON structures or large text blocks that need a scrollable area
               - 'graph' for data that should be visualized as a chart
            2. If 'graph' is selected, specify what type of chart would be best (line, bar, pie, etc.)
            3. Any configuration parameters that would help render this data effectively
            
            Your response should be valid JSON in this format:
            {
              "type": "card" | "table" | "badge" | "text" | "textarea" | "graph",
              "chartType": "line" | "bar" | "pie" | "scatter" | "area" | null, // Only if type is graph
              "config": {
                // Any relevant configuration like titles, labels, colors, etc.
              }
            }
            `;

            const response = await aibot.chatCompletion({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are a helpful assistant." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.3
            });

            let jsonResponse;
            const content = response.message?.content || '';

            // Try to extract JSON from the response
            try {
                // First try direct parsing
                jsonResponse = JSON.parse(content);
            } catch (e) {
                // If that fails, try to extract JSON from markdown
                const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    try {
                        jsonResponse = JSON.parse(jsonMatch[1]);
                    } catch (jsonErr) {
                        // If extraction fails, fall back to the initial guess
                        return { type: initialType as any };
                    }
                } else {
                    // No JSON found, fall back to initial guess
                    return { type: initialType as any };
                }
            }

            // Validate the response has a valid type
            if (jsonResponse &&
                ['card', 'table', 'badge', 'text', 'textarea', 'graph'].includes(jsonResponse.type)) {
                return {
                    type: jsonResponse.type,
                    config: jsonResponse.config || {}
                };
            } else {
                return { type: initialType as any };
            }

        } catch (error) {
            return { type: initialType as any };
        }
    }

    router.get('/functions/:function_id/toggle_active', sessionValidation, async (req, res) => {
        const function_id = req.params.function_id;
        if (!function_id) {
            return res.status(400).json({ message: 'Function ID is required' });
        }
        const _function = getFunctionRegistry().get(function_id);
        if (!_function) {
            return res.status(404).json({ message: 'Function not found' });
        }

        toggleFunctionActive(function_id);

        res.json({ message: 'Function toggled' });
    });




    router.post('/chat', sessionValidation, async (req, res) => {
        const { tools, previous, type } = req.body;

        // Add request timeout - ensure we always respond within 60 seconds
        const requestTimeout = setTimeout(() => {
            if (!res.headersSent) {
                res.status(408).json({
                    message: 'Request timeout',
                    error: 'The request took too long to process',
                    details: 'The AI service didn\'t respond within the expected time limit. Please try again.',
                    debug_info: {
                        timeout: '60 seconds',
                        type,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        }, 60000); // 60 second timeout

        try {
            if (type === '/chat/message') {
                const { inquiry, previous } = req.body;

                // Validate required fields
                if (!inquiry || typeof inquiry !== 'string') {
                    clearTimeout(requestTimeout);
                    return res.status(400).json({
                        message: 'Error processing request',
                        error: 'Invalid input',
                        details: 'Inquiry is required and must be a string',
                        debug_info: {
                            received_inquiry: inquiry,
                            type_of_inquiry: typeof inquiry
                        }
                    });
                }

                // Add error testing conditions
                if (inquiry.startsWith('/error')) {
                    clearTimeout(requestTimeout);
                    const errorType = inquiry.split(' ')[1]?.toLowerCase();

                    switch (errorType) {
                        case 'empty':
                            return res.status(400).json({
                                message: 'Error processing request',
                                error: 'No response generated',
                                details: 'The AI assistant was unable to generate a response (Empty Response Test)',
                                debug_info: {
                                    inquiry,
                                    error_type: 'empty_response_test'
                                }
                            });

                        case 'invalid':
                            return res.status(400).json({
                                message: 'Error processing request',
                                error: 'Invalid response format',
                                details: 'The AI generated an invalid response format (Invalid Format Test)',
                                debug_info: {
                                    inquiry,
                                    error_type: 'invalid_format_test',
                                    invalid_response: { type: 'unknown_type' }
                                }
                            });

                        case 'workflow':
                            return res.status(400).json({
                                message: 'Error processing request',
                                error: 'Workflow Validation Failed',
                                details: 'The workflow is invalid or missing required components',
                                debug_info: {
                                    error_type: 'workflow_error_test',
                                    validation_errors: [
                                        'Missing required actions array',
                                        'Invalid workflow structure'
                                    ],
                                    workflow_state: {
                                        type: 'workflow',
                                        actions: null
                                    }
                                }
                            });

                        case 'server':
                            return res.status(400).json({
                                message: 'Error processing request',
                                error: 'Internal server error',
                                details: 'An unexpected error occurred while processing the request (Server Error Test)',
                                debug_info: {
                                    inquiry,
                                    error_type: 'server_error_test',
                                    stack: 'Test error stack trace'
                                }
                            });

                        default:
                            return res.status(400).json({
                                message: 'Error processing request',
                                error: 'Unknown error type',
                                details: 'Please specify an error type: /error [empty|invalid|workflow|server]',
                                debug_info: {
                                    available_types: ['empty', 'invalid', 'workflow', 'server'],
                                    received: errorType
                                }
                            });
                    }
                }

                try {
                    console.log(`[Chat] Processing inquiry: "${inquiry.substring(0, 100)}${inquiry.length > 100 ? '...' : ''}"`);

                    // Add a promise race with timeout for the AI call
                    const aiCallTimeout = new Promise<never>((_, reject) => {
                        setTimeout(() => reject(new Error('AI_TIMEOUT')), 45000); // 45 second AI timeout
                    });

                    const aiCallPromise = processChatRequest({ inquiry, previous });

                    const result: any = await Promise.race([aiCallPromise, aiCallTimeout]);

                    // Clear the main timeout since we got a response
                    clearTimeout(requestTimeout);

                    // Check for empty or invalid result
                    if (!result?.message) {
                        console.error('[Chat] Empty result from processChatRequest:', result);
                        return res.status(500).json({
                            message: 'Error processing request',
                            error: 'No response generated',
                            details: 'The AI assistant failed to generate a response. This could be due to API issues or rate limiting.',
                            debug_info: {
                                inquiry: inquiry.substring(0, 100) + (inquiry.length > 100 ? '...' : ''),
                                result: result ? 'result_exists_but_no_message' : 'result_is_null_or_undefined',
                                timestamp: new Date().toISOString()
                            }
                        });
                    }

                    try {
                        // Check if the result content is JSON
                        if (result.message.content) {
                            try {
                                const parsedResult = JSON.parse(result.message.content)

                                // Validate workflow response
                                if (parsedResult.type === 'workflow') {
                                    const workflowResult: WorkflowResponse = parsedResult

                                    // Validate workflow structure
                                    if (!workflowResult.actions || !Array.isArray(workflowResult.actions)) {
                                        console.error('[Chat] Invalid workflow structure:', workflowResult);
                                        return res.status(400).json({
                                            message: 'Error processing request',
                                            error: 'Invalid workflow format',
                                            details: 'The AI generated a workflow with invalid structure. Missing or invalid actions array.',
                                            debug_info: {
                                                workflow: workflowResult,
                                                timestamp: new Date().toISOString()
                                            }
                                        });
                                    }

                                    // Clean up function. prefix from tool names before sending to client
                                    if (workflowResult.type === 'workflow' && workflowResult.actions) {
                                        workflowResult.actions = workflowResult.actions.map(action => ({
                                            ...action,
                                            tool: action.tool.replace(/^functions\./, '')
                                        }))
                                    }

                                    console.log(`[Chat] Successfully processed workflow with ${workflowResult.actions.length} actions`);
                                    return res.json({ output: workflowResult })
                                }

                                if (parsedResult.type === 'general') {
                                    const generalResponse: GeneralResponse = parsedResult
                                    if (!generalResponse.content) {
                                        console.error('[Chat] Empty general response content:', generalResponse);
                                        return res.status(500).json({
                                            message: 'Error processing request',
                                            error: 'Empty response content',
                                            details: 'The AI generated a response but the content was empty.',
                                            debug_info: {
                                                result: generalResponse,
                                                timestamp: new Date().toISOString()
                                            }
                                        });
                                    }
                                    console.log(`[Chat] Successfully processed general response`);
                                    return res.status(200).json({
                                        output: generalResponse,
                                    })
                                }

                                // If we get here, the response type is unknown
                                console.error('[Chat] Unknown response type:', parsedResult);
                                return res.status(500).json({
                                    message: 'Error processing request',
                                    error: 'Invalid response type',
                                    details: `The AI generated a response with an unknown type: ${parsedResult.type || 'undefined'}. Expected 'workflow' or 'general'.`,
                                    debug_info: {
                                        parsedResult,
                                        timestamp: new Date().toISOString()
                                    }
                                });

                            } catch (parseError: any) {
                                // Not JSON, wrap the response in the expected format
                                if (result.message.content && result.message.content.trim()) {
                                    console.log(`[Chat] Wrapping non-JSON response in general format`);
                                    const generalResponse: GeneralResponse = {
                                        type: 'general',
                                        content: result.message.content
                                    };
                                    return res.json({
                                        output: generalResponse,
                                    });
                                } else {
                                    console.error('[Chat] Empty content after parse error:', parseError);
                                    return res.status(500).json({
                                        message: 'Error processing request',
                                        error: 'Empty response',
                                        details: 'The AI response could not be parsed and contained no usable content.',
                                        debug_info: {
                                            result: result.message,
                                            parseError: parseError.message,
                                            timestamp: new Date().toISOString()
                                        }
                                    });
                                }
                            }
                        }

                        // If we get here, there's no content in the message
                        console.error('[Chat] No content in message:', result);
                        return res.status(500).json({
                            message: 'Error processing request',
                            error: 'Empty response',
                            details: 'The AI assistant generated a response but it contained no content.',
                            debug_info: {
                                result,
                                timestamp: new Date().toISOString()
                            }
                        });

                    } catch (e: any) {
                        console.error('[Chat] Error processing AI response:', e);
                        clearTimeout(requestTimeout);
                        return res.status(500).json({
                            message: 'Error processing request',
                            error: 'Response processing failed',
                            details: `An error occurred while processing the AI response: ${e.message}`,
                            debug_info: {
                                result,
                                stack: e.stack,
                                timestamp: new Date().toISOString()
                            }
                        });
                    }
                } catch (e: any) {
                    console.error('[Chat] Error in AI request:', e);
                    clearTimeout(requestTimeout);

                    // Handle specific timeout error
                    if (e.message === 'AI_TIMEOUT') {
                        return res.status(408).json({
                            message: 'Request timeout',
                            error: 'AI response timeout',
                            details: 'The AI service took too long to respond. This might be due to high load or complex processing. Please try again with a simpler request.',
                            debug_info: {
                                inquiry: inquiry.substring(0, 100) + (inquiry.length > 100 ? '...' : ''),
                                timeout: '45 seconds',
                                timestamp: new Date().toISOString()
                            }
                        });
                    }

                    // Handle OpenAI specific errors
                    if (e.message.includes('rate_limit_exceeded')) {
                        return res.status(429).json({
                            message: 'Rate limit exceeded',
                            error: 'Too many requests',
                            details: 'The AI service is currently experiencing high demand. Please wait a moment and try again.',
                            debug_info: {
                                inquiry: inquiry.substring(0, 100) + (inquiry.length > 100 ? '...' : ''),
                                error_type: 'rate_limit',
                                timestamp: new Date().toISOString()
                            }
                        });
                    }

                    if (e.message.includes('insufficient_quota')) {
                        return res.status(503).json({
                            message: 'Service temporarily unavailable',
                            error: 'Quota exceeded',
                            details: 'The AI service quota has been exceeded. Please contact support or try again later.',
                            debug_info: {
                                inquiry: inquiry.substring(0, 100) + (inquiry.length > 100 ? '...' : ''),
                                error_type: 'quota_exceeded',
                                timestamp: new Date().toISOString()
                            }
                        });
                    }

                    // Handle network errors
                    if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') {
                        return res.status(503).json({
                            message: 'Service temporarily unavailable',
                            error: 'Network connectivity issue',
                            details: 'Unable to connect to the AI service. Please check your internet connection and try again.',
                            debug_info: {
                                inquiry: inquiry.substring(0, 100) + (inquiry.length > 100 ? '...' : ''),
                                error_code: e.code,
                                error_type: 'network_error',
                                timestamp: new Date().toISOString()
                            }
                        });
                    }

                    // Generic error fallback
                    return res.status(500).json({
                        message: 'Error processing request',
                        error: 'AI service error',
                        details: `An unexpected error occurred while communicating with the AI service: ${e.message}`,
                        debug_info: {
                            inquiry: inquiry.substring(0, 100) + (inquiry.length > 100 ? '...' : ''),
                            stack: e.stack,
                            timestamp: new Date().toISOString()
                        }
                    });
                }
            }

            // Handle unknown request types
            clearTimeout(requestTimeout);
            return res.status(400).json({
                message: 'Error processing request',
                error: 'Unknown request type',
                details: `The request type '${type}' is not supported. Supported type is: '/chat/message'`,
                debug_info: {
                    received_type: type,
                    supported_types: ['/chat/message'],
                    timestamp: new Date().toISOString()
                }
            });
        } catch (e: any) {
            console.error('[Chat] Error in chat request:', e);
            clearTimeout(requestTimeout);
            return res.status(500).json({
                message: 'Error processing request',
                error: 'Internal server error',
                details: `An unexpected error occurred while processing the request: ${e.message}`,
                debug_info: {
                    stack: e.stack,
                    timestamp: new Date().toISOString()
                }
            });
        }
    });

    // Test endpoint for error handling verification
    router.post('/test/error-handling', sessionValidation, async (req, res) => {
        const { testType } = req.body;

        console.log(`[Test] Testing error handling type: ${testType}`);

        switch (testType) {
            case 'timeout':
                // Simulate a timeout
                await new Promise(resolve => setTimeout(resolve, 2000));
                return res.json({
                    success: true,
                    message: 'Timeout test completed - if you see this, timeouts are working correctly',
                    testType: 'timeout'
                });

            case 'error':
                // Simulate an error
                throw new Error('Test error - error handling is working correctly');

            case 'validation':
                // Test validation
                if (!req.body.requiredField) {
                    return res.status(400).json({
                        message: 'Validation test',
                        error: 'Missing required field',
                        details: 'This is a test validation error to verify error handling is working',
                        debug_info: {
                            testType: 'validation',
                            timestamp: new Date().toISOString()
                        }
                    });
                }
                return res.json({
                    success: true,
                    message: 'Validation test passed',
                    testType: 'validation'
                });

            default:
                return res.status(400).json({
                    message: 'Invalid test type',
                    error: 'Unknown test type',
                    details: 'Available test types: timeout, error, validation',
                    debug_info: {
                        received: testType,
                        available: ['timeout', 'error', 'validation'],
                        timestamp: new Date().toISOString()
                    }
                });
        }
    });


    router.post('/workflow/ui-entry-type', sessionValidation, asyncHandler(async (req, res) => {
        const { workflow } = req.body;

        if (!workflow || !workflow.actions || !Array.isArray(workflow.actions)) {
            return res.status(400).json({ error: 'Invalid workflow format' });
        }

        const prompt = `
                You are an assistant that classifies how a given backend workflow should be presented to a user.

                Given the following workflow JSON, identify how the user should interact with it using one of the following entry types:
                - "form": if the workflow requires one or more inputs
                - "button": if it requires no inputs and is simply triggered
                - "auto_update": if it should fetch data periodically without user input
                - "label": if it should only display information without any action

                Respond with strictly valid JSON in this format:

                {
                "entryType": "form" | "button" | "auto_update" | "label",
                "description": "<short summary>",
                "payload": {
                  // For form:
                  "fields": [
                    {
                      "key": "parameter name",
                      "label": "optional label",
                      "type": "string" | "number" | "boolean" | "date" | "enum",
                      "required": true,
                      "enumValues": ["value1", "value2"] // only for enum type
                    }
                  ],
                  
                  // For auto_update:
                  "updateInterval": "optional, only if auto_update, like '10s'",
                  
                  // For label:
                  "isError": false,
                  "message": "optional additional message"
                }
                }

                Your response should only include fields relevant to the selected entryType. For example, "fields" should only be included for "form" type.
                For enum fields, always include the enumValues array with the possible values but only use values given to you in the workflow, do not make up values.

                Here is the workflow:
                \`\`\`
                ${JSON.stringify(workflow, null, 2)}
                \`\`\`
                `;

        const aibot = getAIBot();
        const response = await aibot.chatCompletion({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: prompt }
            ],
            temperature: .8
        });

        try {
            const content = response?.message?.content;
            if (!content) {
                throw new Error('No content in AI response');
            }

            // Extract JSON from markdown code blocks if present
            let jsonContent = content;
            const jsonRegex = /```(?:json)?\s*\n([\s\S]*?)\n```/;
            const match = content.match(jsonRegex);
            if (match && match[1]) {
                jsonContent = match[1];
            }


            const parsed = JSON.parse(jsonContent);

            res.json({ entry: parsed });
        } catch (e) {
            res.status(200).json({
                error: "Failed to parse entry metadata",
                message: "Unable to determine the form type for this workflow. Please try again or contact support.",
                entry: {
                    entryType: "label",
                    description: "Error Processing Workflow",
                    payload: {
                        isError: true,
                        message: "We couldn't determine how to display this workflow. The AI response was not in the expected format."
                    }
                }
            });
        }
    }));


    router.post('/workflow/execute', sessionValidation, async (req, res) => {
        try {
            const { workflow: _workflow, debug = false } = req.body;
            const workflow: WorkflowResponse = _workflow as WorkflowResponse;
            const startTime = new Date();
            const sessionId = req.headers[HEADER_SESSION_TOKEN] as string;
            const userId = req.headers['x-user-id'] as string; // Optional, if you have user ID in headers

            // Generate a unique ID for this workflow execution
            const workflowExecutionId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Audit log data structure
            const auditLog = {
                sessionId,
                userId,
                workflowId: workflowExecutionId, // Use generated ID instead of workflow.id
                input: {
                    workflow,
                    debug
                },
                startTime,
                endTime: null as Date | null,
                duration: 0,
                status: 'pending' as 'pending' | 'success' | 'error',
                result: null as any,
                error: null as any,
                metadata: {
                    actionCount: workflow.actions?.length || 0,
                    tools: workflow.actions?.map(a => a.tool) || []
                }
            };

            if (!workflow || !workflow.actions || !Array.isArray(workflow.actions)) {
                const error = { error: 'Invalid workflow format' };
                auditLog.status = 'error';
                auditLog.error = error;
                auditLog.endTime = new Date();
                auditLog.duration = auditLog.endTime.getTime() - startTime.getTime();

                // Try to send audit log to hub
                try {
                    await fetch(`${process.env.HUB_URL}/audit/workflow`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            [HEADER_API_TOKEN]: apiSecretKey ? apiSecretKey : ''
                        },
                        body: JSON.stringify(auditLog)
                    });
                } catch (hubError) {
                    console.error('Failed to send audit log to hub:', hubError);
                }

                return res.status(400).json(error);
            }

            if (debug) {
                console.log("Executing workflow:", JSON.stringify(workflow, null, 2));
            }

            const functionRegistry = getFunctionRegistry();
            const actionResults: Record<string, any> = {};
            const errors: Array<{ actionId: string, error: string }> = [];

            try {
                for (let i = 0; i < workflow.actions.length; i++) {
                    const action = workflow.actions[i];
                    const actionId = action?.id || `action_${i}`;
                    const toolName = action?.tool.replace(/^functions\./, '') || '';
                    const { parameters } = action || {};
                    const registeredFunction = functionRegistry.get(toolName);

                    if (!registeredFunction) {
                        throw new Error(`Function ${toolName} not found in registry for action "${actionId}"`);
                    }

                    // Debug logging
                    if (debug) {
                        console.log(`\n[Workflow Step ${i + 1}] Processing action "${actionId}" using tool "${toolName}"`);
                        console.log(`Original parameters:`, parameters);
                        console.log(`Current actionResults:`, actionResults);
                    }

                    const processedParameters: Record<string, any> = { ...parameters };
                    const actionErrors: Array<{ actionId: string, error: string }> = [];

                    // Process parameter references
                    for (const [key, value] of Object.entries(parameters || {})) {
                        if (typeof value === 'string' && value.includes('.')) {
                            try {
                                // Check for array notation
                                if (value.includes('[*]')) {
                                    const parts = value.split('.');
                                    if (parts.length < 2) {
                                        throw new Error(`Invalid array reference format: ${value}`);
                                    }
                                    const refActionId = parts[0];
                                    if (!refActionId) {
                                        throw new Error(`Missing action ID in array reference: ${value}`);
                                    }
                                    const baseActionId = refActionId.split('[')[0];
                                    const pathParts = parts.slice(1);
                                    if (debug) {
                                        console.log(`Looking for action result: ${baseActionId}`);
                                        console.log(`Available action results:`, Object.keys(actionResults));
                                    }

                                    if (!baseActionId || !actionResults[baseActionId]) {
                                        throw new Error(`Action result not found: ${baseActionId}`);
                                    }

                                    const arrayResult = actionResults[baseActionId] as unknown[];

                                    if (!Array.isArray(arrayResult)) {
                                        throw new Error(`Expected array from ${baseActionId} but got: ${typeof arrayResult}`);
                                    }

                                    // Map over the array and access the specified properties
                                    const mappedValues = arrayResult.map(item => {
                                        let currentValue = item as Record<string, unknown>;
                                        for (const part of pathParts) {
                                            if (debug) {
                                                console.log(`Accessing property "${part}" from:`, currentValue);
                                            }
                                            if (currentValue === undefined || currentValue === null) {
                                                throw new Error(`Cannot access property ${part} of undefined in ${value}`);
                                            }
                                            currentValue = currentValue[part] as Record<string, unknown>;
                                        }
                                        return currentValue;
                                    });

                                    processedParameters[key] = mappedValues;

                                    if (debug) {
                                        console.log(`Resolved array parameter "${key}" from "${value}" to:`, mappedValues);
                                        console.log(`Available properties in first array item:`,
                                            arrayResult.length > 0 ? Object.keys(arrayResult[0] as object) : 'empty array');
                                    }
                                } else {
                                    // Standard parameter reference
                                    const parts = value.split('.');
                                    if (parts.length >= 2) {
                                        const refActionId = parts[0];
                                        if (refActionId) {
                                            const refResult = actionResults[refActionId];

                                            if (!refResult) {
                                                throw new Error(`Referenced action "${refActionId}" not found or didn't produce a result`);
                                            }

                                            // For deeply nested properties, traverse the object
                                            let currentValue = refResult;

                                            // Start from 1 to skip the action ID
                                            for (let j = 1; j < parts.length; j++) {
                                                const field = parts[j];
                                                if (field && typeof currentValue === 'object' && currentValue !== null && field in currentValue) {
                                                    currentValue = currentValue[field];
                                                } else {
                                                    throw new Error(`Field "${parts.slice(1).join('.')}" not found in the result of action "${refActionId}"`);
                                                }
                                            }

                                            // Handle type conversions based on the expected parameter type
                                            let expectedType = null;
                                            try {
                                                if (typeof registeredFunction.getParams === 'function') {
                                                    const functionParam = registeredFunction.getParams().find(param => {
                                                        if (param instanceof AIObject) {
                                                            return param.getName() === key;
                                                        } else if (param instanceof AIArray) {
                                                            return param.getName() === key;
                                                        } else if (param instanceof AIFieldEnum) {
                                                            return param.getName() === key;
                                                        } else if ('name' in param) {
                                                            return param.name === key;
                                                        }
                                                        return false;
                                                    });

                                                    if (functionParam) {
                                                        // Only apply type conversion if we found a matching parameter
                                                        if (functionParam instanceof AIObject) {
                                                            // Ensure object is actually an object
                                                            if (typeof currentValue !== 'object' || currentValue === null) {
                                                                throw new Error(`Expected object for parameter "${key}" but got ${typeof currentValue}`);
                                                            }
                                                        } else if (functionParam instanceof AIArray) {
                                                            // Ensure array is actually an array
                                                            if (!Array.isArray(currentValue)) {
                                                                throw new Error(`Expected array for parameter "${key}" but got ${typeof currentValue}`);
                                                            }
                                                        } else if ('type' in functionParam) {
                                                            // Basic type conversions for primitive types
                                                            expectedType = functionParam.type;
                                                        }
                                                    }
                                                }

                                                // Apply type conversions based on expected type if found
                                                if (expectedType) {
                                                    if (expectedType === 'string' && typeof currentValue !== 'string') {
                                                        currentValue = String(currentValue);
                                                    } else if (expectedType === 'number' && typeof currentValue !== 'number') {
                                                        const num = Number(currentValue);
                                                        if (isNaN(num)) {
                                                            throw new Error(`Cannot convert "${currentValue}" to number for parameter "${key}"`);
                                                        }
                                                        currentValue = num;
                                                    } else if (expectedType === 'boolean' && typeof currentValue !== 'boolean') {
                                                        if (currentValue === 'true') currentValue = true;
                                                        else if (currentValue === 'false') currentValue = false;
                                                        else if (currentValue === 1) currentValue = true;
                                                        else if (currentValue === 0) currentValue = false;
                                                        else {
                                                            throw new Error(`Cannot convert "${currentValue}" to boolean for parameter "${key}"`);
                                                        }
                                                    }
                                                }

                                                processedParameters[key] = currentValue;

                                                if (debug) {
                                                    console.log(`Resolved parameter "${key}" from "${value}" to:`, currentValue);
                                                }
                                            } catch (typeError: unknown) {
                                                // If we can't validate the type, just use the value as is
                                                processedParameters[key] = currentValue;
                                                if (debug) {
                                                    console.warn(`Skipping type validation for parameter "${key}" (using as-is):`,
                                                        typeError instanceof Error ? typeError.message : String(typeError));
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (paramError) {
                                // Collect errors but continue with other parameters if possible
                                const errorMessage = paramError instanceof Error ? paramError.message : String(paramError);
                                actionErrors.push({ actionId, error: `Parameter error for "${key}": ${errorMessage}` });
                                if (debug) {
                                    console.error(`Error resolving parameter "${key}":`, errorMessage);
                                }
                            }
                        }
                    }

                    // If we have any parameter errors, throw now before executing the function
                    if (actionErrors.length > 0) {
                        errors.push(...actionErrors);
                        throw new Error(`Failed to resolve parameters for action "${actionId}": ${actionErrors.map(e => e.error).join(', ')}`);
                    }

                    if (debug) {
                        console.log(`Processed parameters for "${actionId}":`, processedParameters);
                    }

                    // Enhanced function execution with AI-powered error recovery
                    let functionResult: any = null;
                    let recoveryAttempted = false;

                    try {
                        if ((action?.map ?? false) === true) {
                            const arrayParams = Object.entries(processedParameters).find(
                                ([_, value]) => Array.isArray(value)
                            );

                            if (!arrayParams) {
                                throw new Error(`Action ${actionId} has map:true but no array parameters were found`);
                            }

                            const [arrayParamName, arrayValues] = arrayParams;

                            if (debug) {
                                console.log(`Mapping over ${arrayValues.length} items for parameter "${arrayParamName}"`);
                            }

                            const results = await Promise.all(arrayValues.map(async (item: unknown) => {
                                const itemParams = { ...processedParameters };
                                itemParams[arrayParamName] = item;
                                return await callFunctionFromRegistryFromObject(toolName, itemParams);
                            }));

                            functionResult = results;
                        } else {
                            if (debug) {
                                console.log(`Executing function ${toolName} with parameters:`, processedParameters);
                            }
                            functionResult = await callFunctionFromRegistryFromObject(toolName, processedParameters);
                        }

                        actionResults[actionId] = functionResult;

                        if (debug) {
                            console.log(`Result from "${actionId}":`, functionResult);
                        }

                    } catch (functionError: unknown) {
                        if (debug) {
                            console.log(`❌ Function ${toolName} failed:`, functionError instanceof Error ? functionError.message : String(functionError));
                            console.log(`🤖 Attempting AI-powered error recovery...`);
                        }

                        // AI-powered error recovery
                        try {
                            const errorRecovery = createWorkflowErrorRecovery();
                            const workflowGoal = workflow.description || "Process and analyze data";

                            const recovery = await errorRecovery.analyzeAndRecover(
                                functionError instanceof Error ? functionError : new Error(String(functionError)),
                                {
                                    id: actionId,
                                    tool: toolName,
                                    parameters: processedParameters,
                                    description: action?.description
                                },
                                actionResults,
                                workflowGoal
                            );

                            if (recovery.canContinue && recovery.suggestions.length > 0) {
                                recoveryAttempted = true;

                                // Try recovery suggestions in order of confidence
                                for (const suggestion of recovery.suggestions.sort((a: any, b: any) => b.confidence - a.confidence)) {
                                    if (suggestion.confidence < 0.5) continue;

                                    try {
                                        if (debug) {
                                            console.log(`🔄 Trying recovery: ${suggestion.reasoning} (confidence: ${suggestion.confidence})`);
                                        }

                                        const recoveryFunction = suggestion.newFunction || toolName;
                                        const recoveryParams = suggestion.newParameters || processedParameters;

                                        const firstKey = Object.keys(recoveryParams)[0];
                                        if ((action?.map ?? false) === true && firstKey && Array.isArray(recoveryParams[firstKey])) {
                                            // Handle mapped recovery
                                            const arrayParam = Object.entries(recoveryParams).find(([_, value]) => Array.isArray(value));
                                            if (arrayParam) {
                                                const [arrayParamName, arrayValues] = arrayParam;
                                                const results = await Promise.all((arrayValues as unknown[]).map(async (item: unknown) => {
                                                    const itemParams = { ...recoveryParams };
                                                    itemParams[arrayParamName] = item;
                                                    return await callFunctionFromRegistryFromObject(recoveryFunction, itemParams);
                                                }));
                                                functionResult = results;
                                            }
                                        } else {
                                            functionResult = await callFunctionFromRegistryFromObject(recoveryFunction, recoveryParams);
                                        }

                                        actionResults[actionId] = functionResult;

                                        if (debug) {
                                            console.log(`✅ Recovery successful with ${recoveryFunction}:`, functionResult);
                                        }

                                        break; // Success, stop trying other suggestions

                                    } catch (recoveryError: unknown) {
                                        if (debug) {
                                            console.log(`❌ Recovery attempt failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`);
                                        }
                                        continue; // Try next suggestion
                                    }
                                }

                                // If no recovery worked, create a meaningful error result
                                if (!actionResults[actionId]) {
                                    actionResults[actionId] = {
                                        error: `Function ${toolName} failed and all recovery attempts unsuccessful`,
                                        originalError: functionError instanceof Error ? functionError.message : String(functionError),
                                        recoveryAttempted: true,
                                        suggestions: recovery.suggestions.map((s: any) => s.reasoning)
                                    };

                                    if (debug) {
                                        console.log(`⚠️ All recovery attempts failed for ${actionId}`);
                                    }
                                }
                            } else {
                                // AI determined recovery isn't possible
                                actionResults[actionId] = {
                                    error: `Function ${toolName} failed: ${functionError instanceof Error ? functionError.message : String(functionError)}`,
                                    recoveryNotPossible: true
                                };
                            }

                        } catch (recoverySystemError: unknown) {
                            if (debug) {
                                console.log(`❌ Error recovery system failed:`, recoverySystemError instanceof Error ? recoverySystemError.message : String(recoverySystemError));
                            }

                            // Fallback to simple error result
                            actionResults[actionId] = {
                                error: `Function ${toolName} failed: ${functionError instanceof Error ? functionError.message : String(functionError)}`,
                                recoverySystemError: recoverySystemError instanceof Error ? recoverySystemError.message : String(recoverySystemError)
                            };
                        }
                    }
                }

                const finalAction = workflow.actions[workflow.actions.length - 1];
                const finalResult: Record<string, any> = actionResults[finalAction?.id || ''] as Record<string, any>;
                const initialUIType = guessUIType(finalResult);

                let uiType = initialUIType;
                let uiConfig = {};

                try {
                    const aibot = getAIBot();
                    const enhancedUI = await enhanceOutputUIWithLLM(finalResult, initialUIType, aibot);
                    console.log("enhancedUI", enhancedUI)
                    uiType = enhancedUI.type;
                    uiConfig = enhancedUI.config || {};

                    if (debug) {
                        console.log(`Enhanced UI type: ${uiType} (was: ${initialUIType})`);
                        console.log('UI config:', JSON.stringify(uiConfig, null, 2));
                    }
                } catch (error) {
                    // Silently fall back to initial UI type
                    console.log("ui choosing error", error)
                }

                const finalWorkflowResult: NewWorkflowResult = {
                    actionId: finalAction?.id || '',
                    result: typeof finalResult === 'object' ? finalResult : { value: finalResult },
                    uiElement: {
                        type: 'result',
                        actionId: finalAction?.id || '',
                        tool: finalAction?.tool || '',
                        content: {
                            type: uiType,
                            title: finalAction?.tool || '',
                            content: typeof finalResult === 'object' ? JSON.stringify(finalResult, null, 2) : String(finalResult),
                            timestamp: new Date().toISOString(),
                            config: uiConfig
                        }
                    }
                };

                // Update audit log with success
                auditLog.status = 'success';
                auditLog.result = finalWorkflowResult;
                auditLog.endTime = new Date();
                auditLog.duration = auditLog.endTime.getTime() - startTime.getTime();

                // Try to send audit log to hub
                try {
                    await fetch(`${process.env.HUB_URL}/audit/workflow`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            [HEADER_API_TOKEN]: apiSecretKey ? apiSecretKey : ''
                        },
                        body: JSON.stringify(auditLog)
                    });
                } catch (hubError) {
                    console.error('Failed to send audit log to hub:', hubError);
                }

                res.json(createWorkflowExecutionSuccess([finalWorkflowResult]));

            } catch (error: unknown) {
                const errorMessage = 'Failed to execute workflow';
                const details = error instanceof Error ? error.message : 'Unknown error';

                // Update audit log with error
                auditLog.status = 'error';
                auditLog.error = {
                    message: errorMessage,
                    details,
                    errors: errors.length > 0 ? errors : undefined
                };
                auditLog.endTime = new Date();
                auditLog.duration = auditLog.endTime.getTime() - startTime.getTime();

                // Try to send audit log to hub
                try {
                    await fetch(`${process.env.HUB_URL}/audit/workflow`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            [HEADER_API_TOKEN]: apiSecretKey ? apiSecretKey : ''
                        },
                        body: JSON.stringify(auditLog)
                    });
                } catch (hubError) {
                    console.error('Failed to send audit log to hub:', hubError);
                }

                res.status(400).json(
                    createWorkflowExecutionError(errorMessage, details, errors.length > 0 ? errors : undefined)
                );
            }
        } catch (error) {
            console.error('Failed to execute workflow:', error);
            res.status(400).json(
                createWorkflowExecutionError('Failed to execute workflow', 'Unknown error', [])
            );
        }
    });

    router.get('/', async (req, res) => {
        // Build full URL if sashiServerUrl is not provided
        const baseUrl = sashiServerUrl ?? `${req.protocol}://${req.get('host')}${req.baseUrl}`;
        const newPath = `${baseUrl}/bot`;

        res.redirect(newPath);
        return;
    });

    // =============== AUDIT ENDPOINTS ===============
    router.get('/audit/workflow', sessionValidation, asyncHandler(async (req, res) => {
        return handleWorkflowRequest(req, res, '/audit/workflow', 'GET');
    }));



    router.use('/bot', async (req, res, next) => {
        const sessionToken = await createSessionToken(req, res, getSession);
        // Build API base URL (strip /bot from baseUrl since we need the API root for frontend calls)
        const baseUrlWithoutBot = req.baseUrl.replace(/\/bot$/, '');
        const apiBaseUrl = sashiServerUrl ?? `${req.protocol}://${req.get('host')}${baseUrlWithoutBot}`;

        console.log("apiBaseUrl", sashiServerUrl, `${req.protocol}://${req.get('host')}${baseUrlWithoutBot}`)
        res.type('text/html').send(
            createSashiHtml(apiBaseUrl, sessionToken)
        );
        return;
    });

    // Session validation middleware for UI requests
    router.use('/bot', sessionValidation);

    return router;
};

// Session validation middleware for UI requests
export const validateSessionRequest = ({
    getSession,
    validateSession,
    sessionSecret
}: {
    getSession?: (req: Request, res: Response) => Promise<string>
    validateSession?: (sessionToken: string, req: Request, res: Response) => Promise<boolean>
    sessionSecret?: string
}) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const sessionToken = req.headers[HEADER_SESSION_TOKEN] as string;

        // Skip validation for public endpoints
        const publicEndpoints = ['/sanity-check', '/ping', '/metadata', '/check_hub_connection'];
        if (publicEndpoints.some(endpoint => req.path.includes(endpoint))) {
            return next();
        }

        if (!sessionToken && !!getSession) {
            console.log("validateSessionRequest: Session token required", sessionToken, getSession)
            return res.status(401).json({
                error: 'Session token required',
                message: 'Please provide a valid session token'
            });
        }

        try {
            let isValid = false;

            // Use custom validation if provided
            if (validateSession) {
                isValid = await validateSession(sessionToken, req, res);
            } else if (sessionSecret) {
                // Default JWT-style validation (you can implement JWT signing/verification here)
                // For now, using a simple approach - in production, use proper JWT
                const crypto = require('crypto');
                const expectedSignature = crypto
                    .createHmac('sha256', sessionSecret)
                    .update(sessionToken.split('.')[0] || sessionToken)
                    .digest('hex');

                const providedSignature = sessionToken.split('.')[1];
                if (providedSignature && providedSignature.length > 0) {
                    isValid = crypto.timingSafeEqual(
                        Buffer.from(expectedSignature, 'hex'),
                        Buffer.from(providedSignature, 'hex')
                    );
                } else {
                    isValid = false;
                }
            } else if (getSession) {
                // Fallback: check if the session matches what getSession would return
                const expectedSession = await getSession(req, res);
                isValid = sessionToken === expectedSession;
            } else {
                // Default: accept any non-empty session token (not recommended for production)
                isValid = true;
            }

            if (!isValid) {
                return res.status(401).json({
                    error: 'Invalid session token',
                    message: 'Session token is invalid or expired'
                });
            }

            next();
        } catch (error) {
            return res.status(500).json({
                error: 'Session validation failed',
                message: 'Unable to validate session'
            });
        }
    };
};
