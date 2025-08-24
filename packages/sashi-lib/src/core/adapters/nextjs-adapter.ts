/**
 * Next.js Framework Adapter for Sashi Core
 * Supports both App Router and Pages API
 */

import { FrameworkAdapter, SashiCore, SashiContext } from '../types'

// Next.js API Routes (pages/api) types
interface NextApiRequestLike {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  body: any
  query: Record<string, string | string[]>
  cookies?: Record<string, string>
}

interface NextApiResponseLike {
  status(statusCode: number): NextApiResponseLike
  json(body: any): void
  send(body: any): void
  setHeader(name: string, value: string): void
  getHeader(name: string): string | number | string[] | undefined
  redirect(statusOrUrl: string | number, url?: string): void
  headersSent?: boolean
  end(chunk?: any): void
}

/**
 * Next.js App Router Adapter
 */
export class NextAppRouterAdapter implements FrameworkAdapter<Request, Response, { params?: Record<string, string | string[]> }> {
  
  toWebRequest(req: Request, context?: { params?: Record<string, string | string[]> }): Request {
    // For App Router, the request is already a Web Standards Request
    // We might need to handle body parsing here
    return req
  }
  
  extractContext(req: Request, context?: { params?: Record<string, string | string[]> }): Partial<SashiContext> {
    const url = new URL(req.url)
    
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
    
    // Handle dynamic route parameters
    const params: Record<string, string> = {}
    if (context?.params) {
      Object.entries(context.params).forEach(([key, value]) => {
        if (typeof value === 'string') {
          params[key] = value
        } else if (Array.isArray(value)) {
          params[key] = value.join('/')
        }
      })
    }
    
    // Extract clean path for catch-all routes
    let cleanPath = url.pathname
    const pathSegments = url.pathname.split('/').filter(Boolean)
    
    // Handle catch-all routes - extract the actual path after the catch-all segment
    if (pathSegments.length > 0) {
      // Find the API route segment (usually "api")
      const apiIndex = pathSegments.findIndex(segment => segment === 'api')
      if (apiIndex !== -1 && apiIndex < pathSegments.length - 1) {
        // Take everything after the API route folder (skip the folder name like "sashi-app")
        const routeSegments = pathSegments.slice(apiIndex + 2)
        cleanPath = routeSegments.length > 0 ? '/' + routeSegments.join('/') : '/'
      }
    }
    
    return {
      params,
      query,
      sessionId: req.headers.get('x-sashi-session-token') || undefined,
      userId: req.headers.get('x-user-id') || undefined,
      metadata: {
        originalPath: url.pathname,
        cleanPath: cleanPath
      }
    }
  }
  
  async fromWebResponse(response: Response): Promise<Response> {
    // For App Router, we can return the Web Standards Response directly
    // But we might want to clone it if it's going to be consumed
    return response.clone()
  }
  
  createHandler(core: SashiCore) {
    // Create handlers for each HTTP method
    const createMethodHandler = (method: string) => {
      return async (request: Request, context?: { params?: Record<string, string | string[]> }) => {
        try {
          // Parse request body if needed
          let webRequest = request
          
          if (['POST', 'PUT', 'PATCH'].includes(method) && request.body) {
            // Clone the request to ensure body can be read
            webRequest = request.clone()
          }
          
          // Extract context and adjust for clean routing
          const sashiContext = this.extractContext(webRequest, context)
          
          // Override the request URL to use clean path for routing
          if (sashiContext.metadata?.cleanPath) {
            const originalUrl = new URL(webRequest.url)
            const cleanUrl = new URL(sashiContext.metadata.cleanPath, originalUrl.origin)
            cleanUrl.search = originalUrl.search // Preserve query parameters
            
            webRequest = new Request(cleanUrl.toString(), {
              method: method,
              headers: webRequest.headers,
              body: webRequest.body
            })
          }
          
          // Process with core
          const response = await core.handleRequest(webRequest, sashiContext)
          
          return await this.fromWebResponse(response)
        } catch (error) {
          console.error('Next.js App Router adapter error:', error)
          return new Response(
            JSON.stringify({
              error: 'Internal server error',
              message: 'An unexpected error occurred in the Next.js adapter',
              details: error instanceof Error ? error.message : 'Unknown error'
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        }
      }
    }
    
    return {
      GET: createMethodHandler('GET'),
      POST: createMethodHandler('POST'),
      PUT: createMethodHandler('PUT'),
      DELETE: createMethodHandler('DELETE'),
      PATCH: createMethodHandler('PATCH'),
      OPTIONS: createMethodHandler('OPTIONS'),
      
      // Helper to get all handlers at once
      handlers: {
        GET: createMethodHandler('GET'),
        POST: createMethodHandler('POST'),
        PUT: createMethodHandler('PUT'),
        DELETE: createMethodHandler('DELETE'),
        PATCH: createMethodHandler('PATCH'),
        OPTIONS: createMethodHandler('OPTIONS'),
      }
    }
  }
}

/**
 * Next.js API Routes (pages/api) Adapter
 */
export class NextApiAdapter implements FrameworkAdapter<NextApiRequestLike, NextApiResponseLike> {
  
  toWebRequest(req: NextApiRequestLike): Request {
    // Build full URL
    const url = req.url || '/'
    const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`
    
    // Convert headers
    const headers = new Headers()
    Object.entries(req.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers.set(key, value)
      } else if (Array.isArray(value) && value.length > 0 && value[0]) {
        headers.set(key, value[0])
      }
    })
    
    // Handle request body
    let body: BodyInit | null = null
    if (['POST', 'PUT', 'PATCH'].includes(req.method || 'GET')) {
      if (req.body !== undefined) {
        body = JSON.stringify(req.body)
        headers.set('content-type', 'application/json')
      }
    }
    
    return new Request(fullUrl, {
      method: req.method || 'GET',
      headers,
      body
    })
  }
  
  extractContext(req: NextApiRequestLike): Partial<SashiContext> {
    return {
      params: {},
      query: req.query,
      sessionId: (req.headers['x-sashi-session-token'] as string) || undefined,
      userId: (req.headers['x-user-id'] as string) || undefined,
      metadata: {
        originalRequest: req
      }
    }
  }
  
  async fromWebResponse(response: Response, res: NextApiResponseLike): Promise<NextApiResponseLike> {
    // Set status
    res.status(response.status)
    
    // Set headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })
    
    // Handle different response types
    const contentType = response.headers.get('content-type') || ''
    
    if (contentType.includes('application/json')) {
      const data = await response.json()
      res.json(data)
    } else if (contentType.includes('text/')) {
      const text = await response.text()
      res.send(text)
    } else if (response.status === 302 || response.status === 301) {
      // Handle redirects
      const location = response.headers.get('location')
      if (location) {
        res.redirect(location)
      } else {
        res.status(response.status).end()
      }
    } else {
      // Handle other types or empty responses
      if (response.body) {
        const buffer = await response.arrayBuffer()
        res.send(Buffer.from(buffer))
      } else {
        res.end()
      }
    }
    
    return res
  }
  
  createHandler(core: SashiCore) {
    return async (req: NextApiRequestLike, res: NextApiResponseLike) => {
      try {
        // Convert to Web Standards
        const webRequest = this.toWebRequest(req)
        const context = this.extractContext(req)
        
        // Process with core
        const webResponse = await core.handleRequest(webRequest, context)
        
        // Convert back to Next.js response
        await this.fromWebResponse(webResponse, res)
      } catch (error) {
        console.error('Next.js API adapter error:', error)
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Internal server error',
            message: 'An unexpected error occurred in the Next.js API adapter'
          })
        }
      }
    }
  }
}

/**
 * Factory functions for Next.js
 */
export function createNextAppHandler(core: SashiCore) {
  const adapter = new NextAppRouterAdapter()
  return adapter.createHandler(core)
}

export function createNextApiHandler(core: SashiCore) {
  const adapter = new NextApiAdapter()
  return adapter.createHandler(core)
}
