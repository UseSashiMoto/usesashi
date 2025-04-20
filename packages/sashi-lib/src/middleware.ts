import axios from "axios"
import bodyParser from "body-parser"
import cors from "cors"
import { NextFunction, Request, Response, Router } from "express"

import {
    callFunctionFromRegistryFromObject,
    getFunctionAttributes,
    getFunctionRegistry,
    getRepoRegistry,
    toggleFunctionActive
} from "./ai-function-loader"
import { createAIBot, getAIBot } from "./aibot"

import { processChatRequest, processFunctionRequest } from "./chat"
import { GeneralResponse, WorkflowResponse, WorkflowResult } from "./models/models"
import { MetaData, RepoMetadata } from './models/repo-metadata'
import { createSashiHtml, createSessionToken } from './utils'


const HEADER_API_TOKEN = 'x-api-token';
const HEADER_REPO_TOKEN = 'x-repo-token';

const Sentry = require("@sentry/node");

Sentry.init({
    dsn: 'https://81e05c5cf10d2ec20ef0ab944853ec79@o4508301271105536.ingest.us.sentry.io/4508301273726976', // Replace with your actual DSN
    // Optional configurations
});

const asyncHandler = (fn: (req: Request, res: Response, next?: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
        console.error('Error in middleware:', err);
        Sentry.captureException(err); // Capture the error with Sentry
        next(err);
    });
};






interface MiddlewareOptions {
    debug?: boolean; // enable debug mode
    openAIKey: string
    repos?: string[]
    sashiServerUrl?: string //where the sashi server is hosted if you can't find it automatically
    apiSecretKey?: string // used to validate requests from and to the hub
    repoSecretKey?: string // used to upload metadata for a specific repo and used to validate request to the middleware
    hubUrl?: string // hub where all the repos are hosted
    version?: number //current version of your repo
    addStdLib?: boolean // add the standard library to the hub
    useCloud?: boolean
    langFuseInfo?: {
        publicKey: string
        secretKey: string
        baseUrl: string
    }
    getSession?: (req: Request, res: Response) => Promise<string> // function to get the session id for a request
}

export interface DatabaseClient {
    query: (operation: string, details: any) => Promise<any>;
}


export const validateRepoRequest = ({ sashiServerUrl, repoSecretKey }: {
    sashiServerUrl?: string,
    repoSecretKey?: string
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

            Sentry.addBreadcrumb({
                category: "validation",
                message: `isLocalhost: ${isLocalhost}, isSameDomain: ${isSameDomain}`,
                level: "info",
            });

            if (!isLocalhost && !isSameDomain) {
                // If they are not the same domain or both localhost, validate the secret key
                const secretKey = req.headers[HEADER_REPO_TOKEN];
                Sentry.addBreadcrumb({
                    category: "validation",
                    message: `isLocalhost: ${isLocalhost}, isSameDomain: ${isSameDomain}, secretKey: ${secretKey}: repoSecretKey: ${repoSecretKey}`,
                    level: "info",
                });
                if (!secretKey || secretKey !== repoSecretKey) {
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

export const createMiddleware = (options: MiddlewareOptions) => {
    const {
        openAIKey,
        langFuseInfo,
        sashiServerUrl,
        apiSecretKey,
        repos = [],
        repoSecretKey,
        hubUrl = 'https://hub.usesashi.com',
        version = 1,
        addStdLib = true,
        useCloud = false,
        getSession
    } = options

    if (addStdLib) {
        repos.push("sashi-stdlib")
    }

    const router = Router();

    // CORS middleware inside the router
    router.use((req, res, next) => {
        // Set CORS headers
        res.header('Access-Control-Allow-Origin', '*'); // Or specific origins
        res.header(
            'Access-Control-Allow-Methods',
            'GET, POST, PUT, DELETE, OPTIONS'
        );
        res.header(
            'Access-Control-Allow-Headers',
            'x-sashi-session-token, Content-Type'
        );

        // If it's a preflight request (OPTIONS), respond immediately
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        next(); // Continue to the next middleware or route handler
    });


    createAIBot({ apiKey: openAIKey, sashiSecretKey: apiSecretKey, hubUrl, useCloud })

    const sendMetadataToHub = async () => {
        if (!hubUrl) {
            return;
        }
        try {
            console.log("sending metadata to hub")
            const metadata: Partial<RepoMetadata> = {
                functions: Array.from(getFunctionRegistry().values()).map(
                    (func) => {
                        const functionAtribute = getFunctionAttributes().get(
                            func.getName()
                        );

                        return {
                            name: func.getName(),
                            description: func.getDescription(),
                            needConfirmation: func.getNeedsConfirm(),
                            active: functionAtribute?.active ?? true,
                        };
                    }
                )
            }

            console.log("hub url metadata", `${hubUrl}/metadata`)
            await axios.post(
                `${hubUrl}/metadata`,
                { metadata, version },
                {
                    headers: {
                        [HEADER_API_TOKEN]: apiSecretKey,
                    },
                }
            ).catch(error => {
                console.error('Failed to send metadata to hub:', error);
            });
        } catch (error) {
            console.error(error)
            console.error(`No access to hub: ${hubUrl}/metadata`)
        }
    };




    // Fetch metadata during middleware initialization
    sendMetadataToHub();
    router.use(cors());
    router.use(bodyParser.json());
    router.use(bodyParser.urlencoded({ extended: true }));





    router.get('/sanity-check', (_req, res) => {
        res.json({ message: 'Sashi Middleware is running' });
        return;
    });

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

    router.get('/repos', validateRepoRequest({ sashiServerUrl, repoSecretKey }), async (req, res) => {
        return res.json({ repos: Array.from(getRepoRegistry().values()) });
    });

    router.get('/metadata', validateRepoRequest({ sashiServerUrl, repoSecretKey }), asyncHandler(async (_req, res, next) => {
        const metadata: MetaData = {
            hubUrl: hubUrl,
            functions: Array.from(getFunctionRegistry().values()).map(
                (func) => {
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
                }
            ),
        };
        return res.json(metadata);
    }))

    router.get('/test-error', asyncHandler(async (req, res) => {
        throw new Error('Test error for Sentry');
    }));

    function guessUIType(result: any): 'card' | 'table' | 'badge' {
        if (Array.isArray(result) && result.every(row => typeof row === 'object')) {
            return 'table';
        }
        if (typeof result === 'object' && Object.keys(result).length <= 3) {
            return 'badge';
        }
        return 'card';
    }

    router.get('/call-function', validateRepoRequest({ sashiServerUrl, repoSecretKey }), async (req, res) => {
        const { functionName, args } = req.body;

        if (!functionName) {
            return res.status(400).json({ error: 'Missing function name' });
        }

        const functionRegistry = getFunctionRegistry();
        const registeredFunction = functionRegistry.get(functionName);

        if (!registeredFunction) {
            return res.status(404).json({ error: 'Function not found' });
        }

        const parsedArgs = JSON.parse(args);
        const output = await callFunctionFromRegistryFromObject(
            functionName,
            parsedArgs
        );

        return res.json({ output });
    });

    router.get('/functions/:function_id/toggle_active', async (req, res) => {
        const function_id = req.params.function_id;
        const _function = getFunctionRegistry().get(function_id);
        if (!_function) {
            return res.status(404).json({ message: 'Function not found' });
        }

        toggleFunctionActive(function_id);

        res.json({ message: 'Function toggled' });
    });




    router.post('/chat', async (req, res) => {
        const { tools, previous, type } = req.body;
        if (type === '/chat/function') {


            try {
                const result = await processFunctionRequest({ tools, previous })
                res.json({
                    output: result?.output,
                    tool_calls: result.tool_calls,
                    visualization: result.visualization
                })
            } catch (error: any) {
                res.status(500).json({
                    message: 'Error processing request',
                    error: error.message,
                });
            }
        }
        if (type === '/chat/message') {


            const { inquiry, previous } = req.body;
            try {
                const result = await processChatRequest({ inquiry, previous })



                try {

                    console.log("result before parsing", result.message.content)
                    const parsedResult = JSON.parse(result.message.content)

                    console.log("parsedResult", parsedResult)
                    if (parsedResult.type === 'workflow') {
                        const workflowResult: WorkflowResponse = parsedResult

                        // Clean up function. prefix from tool names before sending to client
                        if (workflowResult.type === 'workflow' && workflowResult.actions) {
                            workflowResult.actions = workflowResult.actions.map(action => ({
                                ...action,
                                tool: action.tool.replace(/^functions\./, '')
                            }))
                        }

                        console.log("result after parsing", workflowResult)

                        res.json({ output: workflowResult })
                    }

                    if (parsedResult.type === 'general') {
                        const result: GeneralResponse = parsedResult
                        return res.status(200).json({
                            output: result,
                        }).send()
                    }


                } catch (e) {
                    res.json({
                        output: "I'm sorry, I'm having trouble processing your request. Please try again later.",
                    });
                }

                res.json({
                    output: result?.message,
                });
            } catch (e: any) {
                res.status(500).json({
                    message: 'Error processing request',
                    error: e.message,
                });
            }
        }
    });


    router.post('/workflow/ui-entry-type', asyncHandler(async (req, res) => {
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

                Respond with strictly valid JSON in this format:

                {
                "entryType": "form" | "button" | "auto_update",
                "description": "<short summary>",
                "updateInterval": "optional, only if auto_update",
                "fields": [
                    {
                    "key": "parameter name",
                    "label": "optional label",
                    "type": "string" | "number" | "boolean" | "date",
                    "required": true
                    }
                ]
                }

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
            temperature: 0.2
        });

        try {
            const content = response.choices[0]?.message?.content;
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
            console.error("Failed to parse AI response cause", e);
            res.status(200).json({
                error: "Failed to parse entry metadata",
                message: "Unable to determine the form type for this workflow. Please try again or contact support.",
                entry: {
                    entryType: "button",
                    description: "Run workflow",
                    fields: []
                }
            });
        }
    }));


    router.post('/workflow/execute', async (req, res) => {
        const { workflow } = req.body;

        if (!workflow || !workflow.actions || !Array.isArray(workflow.actions)) {
            return res.status(400).json({ error: 'Invalid workflow format' });
        }

        const functionRegistry = getFunctionRegistry();
        const actionResults: Record<string, any> = {};

        try {
            for (let i = 0; i < workflow.actions.length; i++) {
                const action = workflow.actions[i];
                const toolName = action.tool.replace(/^functions\./, '');
                const { parameters } = action;
                const registeredFunction = functionRegistry.get(toolName);

                if (!registeredFunction) {
                    throw new Error(`Function ${toolName} not found in registry`);
                }

                const processedParameters: Record<string, any> = { ...parameters };
                for (const [key, value] of Object.entries(parameters)) {
                    if (typeof value === 'string' && value.includes('.')) {
                        const [refActionId, field] = value.split('.');
                        if (!!refActionId) {
                            const refResult = actionResults[refActionId];
                            if (refResult && field) {
                                processedParameters[key] = refResult[field];
                            }
                        }
                    }
                }

                const result = await callFunctionFromRegistryFromObject(toolName, processedParameters);
                actionResults[action.id] = result;
            }

            const finalAction = workflow.actions[workflow.actions.length - 1];
            const finalResult = actionResults[finalAction.id];
            const guessedType = guessUIType(finalResult);

            const finalWorkflowResult: WorkflowResult = {
                actionId: finalAction.id,
                result: typeof finalResult === 'object' ? finalResult : { value: finalResult },
                uiElement: {
                    type: 'result',
                    actionId: finalAction.id,
                    tool: finalAction.tool,
                    content: {
                        type: guessedType,
                        title: finalAction.tool,
                        content: typeof finalResult === 'object' ? JSON.stringify(finalResult, null, 2) : String(finalResult),
                        timestamp: new Date().toISOString()
                    }
                }
            };

            res.json({
                success: true,
                results: [finalWorkflowResult]
            });

        } catch (error: unknown) {
            console.error('Error executing workflow:', error);
            res.status(500).json({
                error: 'Failed to execute workflow',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    router.get('/', async (req, res) => {
        const newPath = `${sashiServerUrl ?? req.originalUrl.replace(/\/$/, '')
            }/bot`;

        res.redirect(newPath);
        return;
    });



    router.use('/bot', async (req, res, next) => {
        const sessionToken = await createSessionToken(req, res, getSession);
        res.type('text/html').send(
            createSashiHtml(sashiServerUrl ?? req.baseUrl, sessionToken)
        );
        next();

        return;
    });

    return router;
};
