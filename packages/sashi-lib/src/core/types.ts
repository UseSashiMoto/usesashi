/**
 * Web Standards-based core types for Sashi
 * Framework-agnostic interfaces using Request/Response APIs
 */

export interface SashiContext {
  /** URL parameters extracted from the route */
  params: Record<string, string>
  
  /** Query parameters from the URL */
  query: Record<string, string | string[]>
  
  /** Session identifier if available */
  sessionId?: string
  
  /** User identifier if available */
  userId?: string
  
  /** Additional framework-specific data */
  metadata?: Record<string, any>
  
  /** Debug mode flag */
  debug?: boolean
}

export interface SashiRequest extends Request {
  /** Sashi-specific context data */
  sashiContext: SashiContext
}

export type SashiHandler = (request: SashiRequest) => Promise<Response>

export interface SashiRoute {
  /** HTTP method */
  method: string
  
  /** URL pattern (supports :param and * wildcards) */
  path: string
  
  /** Main route handler */
  handler: SashiHandler
  
  /** Middleware functions to run before handler */
  middleware?: SashiMiddleware[]
  
  /** Whether this route requires authentication */
  requiresAuth?: boolean
}

export type SashiMiddleware = (request: SashiRequest, next: () => Promise<Response>) => Promise<Response>

export interface SashiCore {
  /** Register a route handler */
  addRoute(route: SashiRoute): void
  
  /** Add global middleware */
  addMiddleware(middleware: SashiMiddleware): void
  
  /** Handle an incoming request */
  handleRequest(request: Request, context: Partial<SashiContext>): Promise<Response>
  
  /** Get all registered routes */
  getRoutes(): SashiRoute[]
}

export interface FrameworkAdapter<TReq = any, TRes = any, TContext = any> {
  /** Convert framework request to Web Standards Request */
  toWebRequest(req: TReq, context?: TContext): Request
  
  /** Extract Sashi context from framework request */
  extractContext(req: TReq, context?: TContext): Partial<SashiContext>
  
  /** Convert Web Standards Response to framework response */
  fromWebResponse(response: Response, original?: TRes): Promise<TRes> | TRes
  
  /** Create a framework-specific handler from Sashi core */
  createHandler(core: SashiCore): any
}

/** Configuration options for Sashi core */
export interface SashiCoreOptions {
  openAIKey: string
  debug?: boolean
  sashiServerUrl?: string
  apiSecretKey?: string
  hubUrl?: string
  langFuseInfo?: {
    publicKey: string
    secretKey: string
    baseUrl: string
  }
  getSession?: (request: Request, context: SashiContext) => Promise<string>
  validateSession?: (sessionToken: string, request: Request, context: SashiContext) => Promise<boolean>
  sessionSecret?: string
}

/** Error response format */
export interface SashiError {
  error: string
  message?: string
  details?: string
  code?: string
  timestamp?: string
  debugInfo?: any
}

/** Success response format */
export interface SashiSuccess<T = any> {
  success: true
  data: T
  timestamp?: string
}

/** Utility type for JSON responses */
export type JsonResponse<T = any> = SashiSuccess<T> | SashiError
