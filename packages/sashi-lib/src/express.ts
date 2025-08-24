// Express-specific entry point
import { ExpressAdapter } from './adapters/express-adapter'
import { createGenericMiddleware, GenericMiddlewareOptions } from './generic-middleware'

// Re-export types that Express users might need
export { HttpRequest, HttpResponse, MiddlewareHandler } from './types/http'

// Express-specific middleware options (extends generic but removes adapter requirement)
export interface ExpressMiddlewareOptions extends Omit<GenericMiddlewareOptions, 'adapter'> {
  // Express-specific options can be added here in the future
}

export const createExpressMiddleware = (options: ExpressMiddlewareOptions) => {
  const adapter = new ExpressAdapter()
  
  // Create the generic middleware with Express adapter
  const genericRouter = createGenericMiddleware({
    ...options,
    adapter
  })

  // Convert generic router to Express router
  // This is a simplified conversion - in a real implementation, 
  // you'd create a proper Express Router and register all routes
  const expressRouter = (req: any, res: any, next: any) => {
    // Convert Express req/res to generic format
    const httpReq = adapter.adaptRequest(req)
    const httpRes = adapter.adaptResponse(res)
    
    // Find matching route
    const route = genericRouter.matchRoute(httpReq.method, httpReq.path)
    
    if (route) {
      // Extract parameters if it's a parameterized route
      httpReq.params = genericRouter.extractParams(route.path, httpReq.path)
      
      // Execute middleware chain
      const executeMiddleware = async (index = 0) => {
        if (index < (route.middleware?.length || 0)) {
          const middleware = route.middleware![index]
          await middleware(httpReq, httpRes, () => executeMiddleware(index + 1))
        } else {
          // Execute the main handler
          await route.handler(httpReq, httpRes)
        }
      }
      
      executeMiddleware().catch(next)
    } else {
      next() // Route not found, pass to next middleware
    }
  }

  // Add Express-specific methods to the router function
  Object.assign(expressRouter, {
    // Provide access to the generic router for advanced usage
    genericRouter,
    
    // Helper method to get all routes (useful for debugging)
    getRoutes: () => genericRouter.getRoutes(),
    
    // Helper method to manually add routes
    addRoute: (method: string, path: string, handler: any) => {
      const httpHandler = (req: any, res: any) => {
        const httpReq = adapter.adaptRequest(req)
        const httpRes = adapter.adaptResponse(res)
        return handler(httpReq, httpRes)
      }
      
      switch (method.toUpperCase()) {
        case 'GET':
          genericRouter.get(path, httpHandler)
          break
        case 'POST':
          genericRouter.post(path, httpHandler)
          break
        case 'PUT':
          genericRouter.put(path, httpHandler)
          break
        case 'DELETE':
          genericRouter.delete(path, httpHandler)
          break
        default:
          throw new Error(`Unsupported HTTP method: ${method}`)
      }
    }
  })

  return expressRouter
}

// Legacy support - keep the original function name for backward compatibility
export const createMiddleware = createExpressMiddleware

// Re-export other utilities that Express users might need
export { validateRepoRequest, validateSessionRequest } from './generic-middleware'