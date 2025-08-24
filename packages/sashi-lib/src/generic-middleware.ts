import { 
  HttpRequest, 
  HttpResponse, 
  HttpRouter, 
  MiddlewareHandler, 
  HttpNextFunction,
  HttpAdapter
} from './types/http'
import { GenericRouter } from './http/generic-router'
import { GenericMiddleware } from './http/generic-middleware'

import {
  callFunctionFromRegistryFromObject,
  getFunctionAttributes,
  getFunctionRegistry,
  toggleFunctionActive
} from "./ai-function-loader"
import { createAIBot, getAIBot } from "./aibot"
import { getSashiAgent } from "./sashiagent"

import { setDefaultOpenAIKey } from "@openai/agents"
import { processChatRequest } from "./chat"
import { getGithubConfig } from "./github-api-service"
import { GeneralResponse, WorkflowResponse } from "./models/models"
import { MetaData } from "./models/repo-metadata"
import { createWorkflowExecutionError, createWorkflowExecutionSuccess, WorkflowResult as NewWorkflowResult } from './types/workflow'
import { createSashiHtml, createSessionToken, ensureUrlProtocol } from './utils'

const HEADER_API_TOKEN = 'x-api-token';
const HEADER_SESSION_TOKEN = 'x-sashi-session-token';

const Sentry = require("@sentry/node");

Sentry.init({
  dsn: 'https://81e05c5cf10d2ec20ef0ab944853ec79@o4508301271105536.ingest.us.sentry.io/4508301273726976',
});

const asyncHandler = (fn: MiddlewareHandler): MiddlewareHandler => {
  return async (req: HttpRequest, res: HttpResponse, next?: HttpNextFunction) => {
    try {
      await Promise.resolve(fn(req, res, next))
    } catch (err) {
      Sentry.captureException(err);
      if (next) {
        next();
      } else {
        console.error('Unhandled error in middleware:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    }
  }
};

export const validateRepoRequest = ({ 
  sashiServerUrl, 
  sashiHubUrl 
}: {
  sashiServerUrl?: string
  sashiHubUrl?: string
}): MiddlewareHandler => {
  return (req: HttpRequest, res: HttpResponse, next?: HttpNextFunction) => {
    const origin = req.headers.origin as string;
    let currentUrl = sashiServerUrl ?? req.hostname ?? '';
    
    try {
      let originHostname = '';
      if (origin) {
        try {
          const originUrl = new URL(origin);
          originHostname = originUrl.hostname;
        } catch (err) {
          Sentry.captureException(err);
          console.error('Invalid origin:', err);
          res.status(403).json({ error: 'Invalid origin' });
          return;
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
        res.status(403).json({ error: 'Unauthorized request' });
        return;
      }

      if (next) {
        next();
      }
    } catch (err) {
      Sentry.captureException(err);
      console.error('Error parsing URLs:', err);
      res.status(403).json({ error: 'Invalid origin or URL' });
    }
  }
};

export interface GenericMiddlewareOptions {
  openAIKey: string
  debug?: boolean
  repos?: string[]
  sashiServerUrl?: string
  apiSecretKey?: string
  hubUrl?: string
  langFuseInfo?: {
    publicKey: string
    secretKey: string
    baseUrl: string
  }
  getSession?: (req: HttpRequest, res: HttpResponse) => Promise<string>
  validateSession?: (sessionToken: string, req: HttpRequest, res: HttpResponse) => Promise<boolean>
  sessionSecret?: string
  adapter: HttpAdapter
}

export interface DatabaseClient {
  query: (operation: string, details: any) => Promise<any>;
}

export const createGenericMiddleware = (options: GenericMiddlewareOptions): HttpRouter => {
  const {
    openAIKey,
    debug = false,
    sashiServerUrl: rawSashiServerUrl,
    apiSecretKey,
    hubUrl: rawHubUrl = 'https://hub.usesashi.com',
    getSession,
    validateSession,
    sessionSecret,
    adapter
  } = options

  const sashiServerUrl = rawSashiServerUrl ? ensureUrlProtocol(rawSashiServerUrl) : undefined;
  const hubUrl = ensureUrlProtocol(rawHubUrl);

  const router = new GenericRouter();
  const middleware = new GenericMiddleware();

  // Apply CORS middleware
  router.use(middleware.cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-token', 'x-sashi-session-token'],
  }));

  // Apply body parser middleware
  router.use(middleware.bodyParser.json());
  router.use(middleware.bodyParser.urlencoded({ extended: true }));

  // Initialize OpenAI and other services
  try {
    setDefaultOpenAIKey(openAIKey);
    console.log('✅ OpenAI agents library configured successfully');
  } catch (error) {
    console.error('❌ Failed to configure OpenAI agents library:', error);
    throw new Error(`Failed to configure OpenAI agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  createAIBot({ apiKey: openAIKey, sashiSecretKey: apiSecretKey, hubUrl })

  // Create session validation middleware
  const sessionValidation = validateSessionRequest({
    getSession,
    validateSession,
    sessionSecret
  });

  // Basic routes
  router.get('/sanity-check', (_req, res) => {
    res.json({ message: 'Sashi Middleware is running' });
  });

  router.get('/ping', (req, res) => {
    const apiToken = req.headers[HEADER_API_TOKEN] as string;
    if (apiToken !== apiSecretKey) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.status(200).json({ token: apiToken, message: 'Sashi Middleware is running' });
  });

  router.get('/metadata', validateRepoRequest({ sashiServerUrl, sashiHubUrl: hubUrl }), asyncHandler(async (_req, res) => {
    const metadata: MetaData = {
      hubUrl: hubUrl,
      functions: Array.from(getFunctionRegistry().values())
        .filter(func => {
          const functionAttribute = getFunctionAttributes().get(func.getName());
          return !functionAttribute?.isHidden;
        })
        .map((func) => {
          const functionAttribute = getFunctionAttributes().get(func.getName());
          return {
            name: func.getName(),
            description: func.getDescription(),
            needConfirmation: func.getNeedsConfirm(),
            active: functionAttribute?.active ?? true,
            isVisualization: false,
          };
        }),
    };
    res.json(metadata);
  }));

  // Chat endpoint
  router.post('/chat', sessionValidation, asyncHandler(async (req, res) => {
    const { type } = req.body;

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
    }, 60000);

    try {
      if (type === '/chat/message') {
        const { inquiry, previous } = req.body;

        if (!inquiry || typeof inquiry !== 'string') {
          clearTimeout(requestTimeout);
          res.status(400).json({
            message: 'Error processing request',
            error: 'Invalid input',
            details: 'Inquiry is required and must be a string',
            debug_info: {
              received_inquiry: inquiry,
              type_of_inquiry: typeof inquiry
            }
          });
          return;
        }

        const githubConfig = await getGithubConfig({ hubUrl, apiSecretKey });
        const result = await processChatRequest({ inquiry, previous }, githubConfig);

        clearTimeout(requestTimeout);

        if (!result?.content) {
          res.status(500).json({
            message: 'Error processing request',
            error: 'No response generated',
            details: 'The AI assistant failed to generate a response.',
            debug_info: {
              inquiry: inquiry.substring(0, 100) + (inquiry.length > 100 ? '...' : ''),
              result: result ? 'result_exists_but_no_message' : 'result_is_null_or_undefined',
              timestamp: new Date().toISOString()
            }
          });
          return;
        }

        if (result.type === 'general') {
          const generalResponse: GeneralResponse = result
          if (!generalResponse.content) {
            res.status(500).json({
              message: 'Error processing request',
              error: 'Empty response content',
              details: 'The AI generated a response but the content was empty.',
              debug_info: {
                result: generalResponse,
                timestamp: new Date().toISOString()
              }
            });
            return;
          }
          res.status(200).json({ output: generalResponse });
          return;
        }

        res.status(500).json({
          message: 'Error processing request',
          error: 'Invalid response type',
          details: `The AI generated a response with an unexpected type: ${result.type || 'undefined'}`,
          debug_info: {
            result,
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error: any) {
      clearTimeout(requestTimeout);
      console.error('[Chat] Error in chat request:', error);
      res.status(500).json({
        message: 'Error processing request',
        error: 'Internal server error',
        details: `An unexpected error occurred: ${error.message}`,
        debug_info: {
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      });
    }
  }));

  // Bot UI route
  router.get('/bot', async (req, res) => {
    const sessionToken = await createSessionToken(req, res, getSession);
    const baseUrl = sashiServerUrl ?? `${req.protocol}://${req.hostname}`;
    res.type('text/html');
    res.send(createSashiHtml(baseUrl, sessionToken));
  });

  return router;
};

// Session validation middleware
export const validateSessionRequest = ({
  getSession,
  validateSession,
  sessionSecret
}: {
  getSession?: (req: HttpRequest, res: HttpResponse) => Promise<string>
  validateSession?: (sessionToken: string, req: HttpRequest, res: HttpResponse) => Promise<boolean>
  sessionSecret?: string
}): MiddlewareHandler => {
  return async (req: HttpRequest, res: HttpResponse, next?: HttpNextFunction) => {
    const sessionToken = req.headers[HEADER_SESSION_TOKEN] as string;

    const publicEndpoints = ['/sanity-check', '/ping', '/metadata', '/check_hub_connection'];
    if (publicEndpoints.some(endpoint => req.path.includes(endpoint))) {
      if (next) next();
      return;
    }

    if (!sessionToken && !!getSession) {
      res.status(401).json({
        error: 'Session token required',
        message: 'Please provide a valid session token'
      });
      return;
    }

    try {
      let isValid = false;

      if (validateSession) {
        isValid = await validateSession(sessionToken, req, res);
      } else if (sessionSecret) {
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
        const expectedSession = await getSession(req, res);
        isValid = sessionToken === expectedSession;
      } else {
        isValid = true;
      }

      if (!isValid) {
        res.status(401).json({
          error: 'Invalid session token',
          message: 'Session token is invalid or expired'
        });
        return;
      }

      if (next) next();
    } catch (error) {
      res.status(500).json({
        error: 'Session validation failed',
        message: 'Unable to validate session'
      });
    }
  };
};