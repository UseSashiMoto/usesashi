/**
 * Sashi Core - Web Standards based request handler
 * Framework-agnostic core that can be adapted to any Node.js framework
 */

import { SashiCore, SashiRoute, SashiMiddleware, SashiCoreOptions, SashiRequest, SashiContext } from './types'
import { 
  handleSanityCheck, 
  handlePing, 
  handleMetadata, 
  handleHubConnectionCheck,
  handleFunctionToggle,
  handleTestError
} from './handlers'

/**
 * Route matching utility
 */
function matchRoute(pattern: string, path: string): { matches: boolean; params: Record<string, string> } {
  const params: Record<string, string> = {}
  
  // Convert route pattern to regex
  const regexPattern = pattern
    .replace(/:[^/]+/g, '([^/]+)') // :param -> capturing group
    .replace(/\*/g, '(.*)') // * -> capturing group for everything
    .replace(/\//g, '\\/') // escape forward slashes
  
  const regex = new RegExp(`^${regexPattern}$`)
  const match = path.match(regex)
  
  if (!match) {
    return { matches: false, params: {} }
  }
  
  // Extract parameter names from pattern
  const paramNames = [...pattern.matchAll(/:([^/]+)/g)].map(match => match[1])
  
  // Map captured groups to parameter names
  paramNames.forEach((name, index) => {
    const value = match[index + 1]
    if (value !== undefined && name) {
      params[name] = value
    }
  })
  
  return { matches: true, params }
}

/**
 * CORS middleware for Web Standards
 */
function createCorsMiddleware(): SashiMiddleware {
  return async (request: SashiRequest, next: () => Promise<Response>): Promise<Response> => {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-api-token, x-sashi-session-token',
          'Access-Control-Max-Age': '86400'
        }
      })
    }
    
    // Process request and add CORS headers to response
    const response = await next()
    
    // Add CORS headers to response
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-api-token, x-sashi-session-token')
    
    return response
  }
}

/**
 * Session validation middleware
 */
function createSessionMiddleware(options: SashiCoreOptions): SashiMiddleware {
  return async (request: SashiRequest, next: () => Promise<Response>): Promise<Response> => {
    const sessionToken = request.headers.get('x-sashi-session-token')
    
    // Skip validation for public endpoints
    const publicEndpoints = ['/sanity-check', '/ping', '/metadata', '/check_hub_connection']
    const url = new URL(request.url)
    const isPublicEndpoint = publicEndpoints.some(endpoint => url.pathname.includes(endpoint))
    
    if (isPublicEndpoint) {
      return next()
    }
    
    // If no getSession function is provided, allow all requests (backward compatibility)
    if (!options.getSession) {
      return next()
    }
    
    if (!sessionToken) {
      return new Response(JSON.stringify({
        error: 'Session token required',
        message: 'Please provide a valid session token'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    try {
      let isValid = false
      
      if (options.validateSession) {
        isValid = await options.validateSession(sessionToken, request, request.sashiContext)
      } else if (options.sessionSecret) {
        // Simple HMAC validation (in production, use proper JWT)
        const crypto = require('crypto')
        const expectedSignature = crypto
          .createHmac('sha256', options.sessionSecret)
          .update(sessionToken.split('.')[0] || sessionToken)
          .digest('hex')
          
        const providedSignature = sessionToken.split('.')[1]
        if (providedSignature && providedSignature.length > 0) {
          isValid = crypto.timingSafeEqual(
            Buffer.from(expectedSignature, 'hex'),
            Buffer.from(providedSignature, 'hex')
          )
        }
      } else if (options.getSession) {
        // Fallback: check if the session matches what getSession would return
        const expectedSession = await options.getSession(request, request.sashiContext)
        isValid = sessionToken === expectedSession
      } else {
        // Default: accept any non-empty session token
        isValid = true
      }
      
      if (!isValid) {
        return new Response(JSON.stringify({
          error: 'Invalid session token',
          message: 'Session token is invalid or expired'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      return next()
    } catch (error) {
      console.error('Session validation error:', error)
      return new Response(JSON.stringify({
        error: 'Session validation failed',
        message: 'Unable to validate session'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}

/**
 * Main Sashi Core implementation
 */
export class SashiCoreImpl implements SashiCore {
  private routes: SashiRoute[] = []
  private globalMiddleware: SashiMiddleware[] = []
  private options: SashiCoreOptions
  
  constructor(options: SashiCoreOptions) {
    this.options = options
    
    // Add global middleware
    this.addMiddleware(createCorsMiddleware())
    this.addMiddleware(createSessionMiddleware(options))
    
    // Register built-in routes
    this.registerBuiltInRoutes()
  }
  
  addRoute(route: SashiRoute): void {
    this.routes.push(route)
  }
  
  addMiddleware(middleware: SashiMiddleware): void {
    this.globalMiddleware.push(middleware)
  }
  
  getRoutes(): SashiRoute[] {
    return [...this.routes]
  }
  
  async handleRequest(request: Request, context: Partial<SashiContext> = {}): Promise<Response> {
    try {
      // Create enhanced request with Sashi context
      const sashiRequest = this.createSashiRequest(request, context)
      
      // Handle CORS preflight requests immediately (before route matching)
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-api-token, x-sashi-session-token',
            'Access-Control-Max-Age': '86400'
          }
        })
      }
      
      // Find matching route
      const matchedRoute = this.findMatchingRoute(sashiRequest)
      
      if (!matchedRoute) {
        const response = new Response(JSON.stringify({
          error: 'Not found',
          message: `No route found for ${request.method} ${new URL(request.url).pathname}`
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
        
        // Add CORS headers even to 404 responses
        response.headers.set('Access-Control-Allow-Origin', '*')
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-api-token, x-sashi-session-token')
        
        return response
      }
      
      const { route, params } = matchedRoute
      
      // Update context with matched parameters
      sashiRequest.sashiContext.params = { ...sashiRequest.sashiContext.params, ...params }
      
      // Execute middleware chain
      const allMiddleware = [...this.globalMiddleware, ...(route.middleware || [])]
      
      return this.executeMiddlewareChain(sashiRequest, allMiddleware, route.handler)
    } catch (error) {
      console.error('Core request handling error:', error)
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  
  private createSashiRequest(request: Request, context: Partial<SashiContext>): SashiRequest {
    const url = new URL(request.url)
    
    // Extract query parameters
    const query: Record<string, string | string[]> = {}
    url.searchParams.forEach((value, key) => {
      const existing = query[key]
      if (existing) {
        query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value]
      } else {
        query[key] = value
      }
    })
    
    // Build Sashi context
    const sashiContext: SashiContext = {
      params: {},
      query,
      debug: this.options.debug,
      metadata: {
        apiSecretKey: this.options.apiSecretKey,
        hubUrl: this.options.hubUrl,
        sashiServerUrl: this.options.sashiServerUrl,
        ...this.options
      },
      ...context
    }
    
    // Create enhanced request
    const sashiRequest = request as SashiRequest
    sashiRequest.sashiContext = sashiContext
    
    return sashiRequest
  }
  
  private findMatchingRoute(request: SashiRequest): { route: SashiRoute; params: Record<string, string> } | null {
    const url = new URL(request.url)
    const method = request.method
    const pathname = url.pathname
    
    for (const route of this.routes) {
      if (route.method !== method) continue
      
      const { matches, params } = matchRoute(route.path, pathname)
      if (matches) {
        return { route, params }
      }
    }
    
    return null
  }
  
  private async executeMiddlewareChain(
    request: SashiRequest,
    middleware: SashiMiddleware[],
    handler: (req: SashiRequest) => Promise<Response>
  ): Promise<Response> {
    let index = 0
    
    const next = async (): Promise<Response> => {
      if (index < middleware.length) {
        const currentMiddleware = middleware[index++]
        if (currentMiddleware) {
          return currentMiddleware(request, next)
        } else {
          return next() // Skip undefined middleware
        }
      } else {
        return handler(request)
      }
    }
    
    return next()
  }
  
  private registerBuiltInRoutes(): void {
    // Health check
    this.addRoute({
      method: 'GET',
      path: '/sanity-check',
      handler: handleSanityCheck
    })
    
    // Ping with auth
    this.addRoute({
      method: 'GET',
      path: '/ping',
      handler: handlePing
    })
    
    // Metadata
    this.addRoute({
      method: 'GET',
      path: '/metadata',
      handler: handleMetadata
    })
    
    // Hub connection check
    this.addRoute({
      method: 'GET',
      path: '/check_hub_connection',
      handler: handleHubConnectionCheck
    })
    
    // Function toggle
    this.addRoute({
      method: 'GET',
      path: '/functions/:function_id/toggle_active',
      handler: handleFunctionToggle,
      requiresAuth: true
    })
    
    // Test error handling
    this.addRoute({
      method: 'POST',
      path: '/test/error-handling',
      handler: handleTestError,
      requiresAuth: true
    })
    
    // Root redirect
    this.addRoute({
      method: 'GET',
      path: '/',
      handler: async (request: SashiRequest): Promise<Response> => {
        const baseUrl = request.sashiContext.metadata?.sashiServerUrl || 
                        `${new URL(request.url).origin}/sashi`
        const redirectUrl = `${baseUrl}/bot`
        
        return new Response(null, {
          status: 302,
          headers: {
            'Location': redirectUrl
          }
        })
      }
    })
  }
}

/**
 * Factory function to create Sashi Core instance
 */
export function createSashiCore(options: SashiCoreOptions): SashiCore {
  return new SashiCoreImpl(options)
}
