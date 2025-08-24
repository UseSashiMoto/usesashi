// Next.js-specific entry points
import { NextApiAdapter, NextAppRouterAdapter } from './adapters/nextjs-adapter'
import { createGenericMiddleware, GenericMiddlewareOptions } from './generic-middleware'

// Re-export types that Next.js users might need
export { HttpRequest, HttpResponse, MiddlewareHandler } from './types/http'

// Next.js-specific middleware options
export interface NextMiddlewareOptions extends Omit<GenericMiddlewareOptions, 'adapter'> {
  // Next.js-specific options can be added here
}

// For Next.js API Routes (pages/api)
export const createNextApiHandler = (options: NextMiddlewareOptions) => {
  const adapter = new NextApiAdapter()
  
  const genericRouter = createGenericMiddleware({
    ...options,
    adapter
  })

  // Return a Next.js API handler
  return async (req: any, res: any) => {
    try {
      const httpReq = adapter.adaptRequest(req)
      const httpRes = adapter.adaptResponse(res)
      
      // Find matching route
      const route = genericRouter.matchRoute(httpReq.method, httpReq.path)
      
      if (route) {
        // Extract parameters
        httpReq.params = genericRouter.extractParams(route.path, httpReq.path)
        
        // Execute middleware chain
        const executeMiddleware = async (index = 0) => {
          if (index < (route.middleware?.length || 0)) {
            const middleware = route.middleware![index]
            await middleware(httpReq, httpRes, () => executeMiddleware(index + 1))
          } else {
            await route.handler(httpReq, httpRes)
          }
        }
        
        await executeMiddleware()
      } else {
        res.status(404).json({ error: 'Not found' })
      }
    } catch (error) {
      console.error('Next.js API handler error:', error)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  }
}

// For Next.js App Router (app/api)
export const createNextAppHandler = (options: NextMiddlewareOptions) => {
  const adapter = new NextAppRouterAdapter()
  
  const genericRouter = createGenericMiddleware({
    ...options,
    adapter
  })

  // Create handlers for each HTTP method
  const createMethodHandler = (method: string) => {
    return async (request: Request) => {
      try {
        const httpReq = adapter.adaptRequest(request as any)
        const httpRes = adapter.adaptResponse({} as any) // App Router uses different response handling
        
        // Override method to match the specific handler
        httpReq.method = method
        
        const route = genericRouter.matchRoute(method, httpReq.path)
        
        if (route) {
          httpReq.params = genericRouter.extractParams(route.path, httpReq.path)
          
          let responseData: any = null
          let statusCode = 200
          const responseHeaders: Record<string, string> = {}

          // Create a custom response handler for App Router
          const appRouterRes = {
            status: (code: number) => {
              statusCode = code
              return appRouterRes
            },
            json: (data: any) => {
              responseData = data
              responseHeaders['Content-Type'] = 'application/json'
            },
            send: (data: string) => {
              responseData = data
            },
            setHeader: (name: string, value: string) => {
              responseHeaders[name] = value
            },
            getHeader: (name: string) => responseHeaders[name],
            redirect: (url: string) => {
              statusCode = 302
              responseHeaders['Location'] = url
            },
            type: (contentType: string) => {
              responseHeaders['Content-Type'] = contentType
            },
            headersSent: false
          }

          // Execute middleware chain
          const executeMiddleware = async (index = 0) => {
            if (index < (route.middleware?.length || 0)) {
              const middleware = route.middleware![index]
              await middleware(httpReq, appRouterRes as any, () => executeMiddleware(index + 1))
            } else {
              await route.handler(httpReq, appRouterRes as any)
            }
          }
          
          await executeMiddleware()

          // Create Response object
          if (responseHeaders['Location']) {
            return new Response(null, {
              status: statusCode,
              headers: responseHeaders
            })
          } else if (responseData !== null) {
            const body = typeof responseData === 'string' 
              ? responseData 
              : JSON.stringify(responseData)
            return new Response(body, {
              status: statusCode,
              headers: responseHeaders
            })
          } else {
            return new Response(null, { status: statusCode, headers: responseHeaders })
          }
        } else {
          return new Response(
            JSON.stringify({ error: 'Not found' }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        }
      } catch (error) {
        console.error('Next.js App Router handler error:', error)
        return new Response(
          JSON.stringify({ error: 'Internal server error' }),
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

// Convenience function for single-method API routes
export const createSingleMethodHandler = (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  options: NextMiddlewareOptions
) => {
  const handlers = createNextAppHandler(options)
  return handlers[method]
}

// Re-export utilities
export { validateRepoRequest, validateSessionRequest } from './generic-middleware'