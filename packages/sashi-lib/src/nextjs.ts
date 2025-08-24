// Next.js-specific entry points
import { NextApiAdapter, NextAppRouterAdapter } from './adapters/nextjs-adapter'
import { createGenericMiddleware, GenericMiddlewareOptions } from './http/generic-middleware'

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

        // Execute middleware chainok
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
  }) as any

  // Create handlers for each HTTP method
  const createMethodHandler = (method: string) => {
    return async (request: Request, context?: { params?: Record<string, string | string[]> }) => {
      try {
        // Parse request body if needed
        let body: any = undefined
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          const contentType = request.headers.get('content-type') || ''
          if (contentType.includes('application/json')) {
            try {
              body = await request.json()
            } catch (e) {
              // Body might already be consumed or empty
              body = undefined
            }
          } else if (contentType.includes('application/x-www-form-urlencoded')) {
            try {
              const text = await request.text()
              body = Object.fromEntries(new URLSearchParams(text))
            } catch (e) {
              body = undefined
            }
          }
        }

        // Create a modified request with the parsed body
        const requestWithBody = new Proxy(request, {
          get(target, prop) {
            if (prop === 'json') {
              return async () => body
            }
            if (prop === 'body' && body !== undefined) {
              return body
            }
            return (target as any)[prop]
          }
        })

        const httpReq = adapter.adaptRequest(requestWithBody as any)
        httpReq.method = method

        // Handle dynamic route parameters
        if (context?.params) {
          // Only assign string values, ignore string[] for compatibility
          httpReq.params = {
            ...httpReq.params,
            ...Object.fromEntries(
              Object.entries(context.params).filter(([_, v]) => typeof v === 'string')
            )
          }
        }

        // Extract clean path for route matching
        const url = new URL(request.url)
        const pathSegments = url.pathname.split('/').filter(Boolean)

        // Handle catch-all routes - extract the actual path after the catch-all segment
        if (pathSegments.length > 0) {
          // Find the API route segment (usually ends with the catch-all folder name)
          const apiIndex = pathSegments.findIndex(segment => segment.startsWith('api'))
          if (apiIndex !== -1 && apiIndex < pathSegments.length - 1) {
            // Take everything after the API route folder
            const routeSegments = pathSegments.slice(apiIndex + 2) // Skip 'api' and route folder
            httpReq.path = routeSegments.length > 0 ? '/' + routeSegments.join('/') : '/'
          }
        }

        // Find matching route
        const route = genericRouter.matchRoute(method, httpReq.path)

        if (route) {
          httpReq.params = { ...httpReq.params, ...genericRouter.extractParams(route.path, httpReq.path) }

          // Create response handler using the adapter
          const httpRes = adapter.adaptResponse({} as any)

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

          // The adapter's createHandler method should return the proper Response
          const handler = adapter.createHandler(async (req, res) => {
            await executeMiddleware()
          })

          return await handler(requestWithBody as any)
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
          JSON.stringify({
            error: 'Internal server error',
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

// Convenience function for single-method API routes
export const createSingleMethodHandler = (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  options: NextMiddlewareOptions
) => {
  const handlers = createNextAppHandler(options)
  return handlers[method]
}

// Re-export utilities from generic middleware
export { validateRepoRequest, validateSessionRequest } from './http/generic-middleware'
