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
import { createAIBot } from "./aibot"

import { processChatRequest, processFunctionRequest } from "./chat"
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

function getUniqueId() {
    return (
        Math.random().toString(36).substring(2) +
        new Date().getTime().toString(36)
    )
}



interface MiddlewareOptions {
    debug?: boolean; // enable debug mode
    openAIKey: string
    repos?: string[]
    sashiServerUrl?: string //where the sashi server is hosted if you can't find it automatically
    apiSecretKey?: string // used to validate requests from and to the hub
    repoSecretKey?: string // used to upload metadata for a specific repo
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
        const origin = req.headers.origin || '';
        const currentUrl = sashiServerUrl ?? req.get('host') ?? '';

        try {

            // Parse the origin and current URL to get the hostname
            const originUrl = new URL(origin);
            const currentUrlObj = new URL(`http://${currentUrl}`); // Ensure currentUrl is treated as a full URL
            Sentry.addBreadcrumb({
                category: "validation",
                message: `origin: ${origin}, currentUrl: ${currentUrl}`,
                level: "info",
            });
            // Check if both are localhost or if the origin matches the current domain
            const isLocalhost =
                originUrl.hostname === 'localhost' &&
                currentUrlObj.hostname === 'localhost';
            const isSameDomain = originUrl.hostname === currentUrlObj.hostname;
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
                    message: `secretKey: ${secretKey}`,
                    level: "info",
                });
                if (!secretKey || secretKey !== repoSecretKey) {
                    Sentry.addBreadcrumb({
                        category: "validation",
                        message: `Unauthorized request`,
                        level: "error",
                    });
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
