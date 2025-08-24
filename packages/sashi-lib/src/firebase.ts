// Firebase Functions-specific entry points
import { FirebaseAdapter, FirebaseCallableAdapter } from './adapters/firebase-adapter'
import { createGenericMiddleware, GenericMiddlewareOptions } from './generic-middleware'

// Re-export types that Firebase users might need
export { HttpRequest, HttpResponse, MiddlewareHandler } from './types/http'

// Firebase-specific middleware options
export interface FirebaseMiddlewareOptions extends Omit<GenericMiddlewareOptions, 'adapter'> {
  // Firebase-specific options can be added here
}

// For Firebase HTTP Functions
export const createFirebaseHttpFunction = (options: FirebaseMiddlewareOptions) => {
  const adapter = new FirebaseAdapter()

  const genericRouter = createGenericMiddleware({
    ...options,
    adapter
  }) as any

  return (req: any, res: any) => {
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

        executeMiddleware().catch((error) => {
          console.error('Firebase HTTP function error:', error)
          if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' })
          }
        })
      } else {
        res.status(404).json({ error: 'Not found' })
      }
    } catch (error) {
      console.error('Firebase HTTP function error:', error)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  }
}

// For Firebase Callable Functions
export const createFirebaseCallableFunction = (options: FirebaseMiddlewareOptions) => {
  const callableAdapter = new FirebaseCallableAdapter()

  // Create a simplified handler for callable functions
  return callableAdapter.createCallableHandler(async (data, context) => {
    try {
      // For callable functions, we might want to expose specific endpoints
      // This is a simplified implementation - in practice, you'd want to
      // map callable function data to specific routes/actions

      const { action, ...actionData } = data

      switch (action) {
        case 'chat':
          // Handle chat requests
          if (!actionData.inquiry) {
            throw new Error('Inquiry is required for chat action')
          }

          // This would need to be implemented based on your specific chat logic
          // For now, return a placeholder
          return {
            type: 'general',
            content: `Chat response for: ${actionData.inquiry}`
          }

        case 'workflow':
          // Handle workflow execution
          if (!actionData.workflow) {
            throw new Error('Workflow is required for workflow action')
          }

          // This would need workflow execution logic
          return {
            success: true,
            message: 'Workflow executed successfully'
          }

        default:
          throw new Error(`Unknown action: ${action}`)
      }
    } catch (error) {
      console.error('Firebase Callable function error:', error)
      throw new Error(error instanceof Error ? error.message : 'Internal server error')
    }
  })
}

// Convert HTTP middleware to callable function
export const convertHttpToCallable = (options: FirebaseMiddlewareOptions) => {
  const adapter = new FirebaseAdapter()
  const callableAdapter = new FirebaseCallableAdapter()

  const genericRouter = createGenericMiddleware({
    ...options,
    adapter
  }) as any

  // Create a simplified HTTP handler
  const httpHandler = async (req: any, res: any) => {
    const httpReq = adapter.adaptRequest(req)
    const httpRes = adapter.adaptResponse(res)

    const route = genericRouter.matchRoute(httpReq.method, httpReq.path)

    if (route) {
      httpReq.params = genericRouter.extractParams(route.path, httpReq.path)
      await route.handler(httpReq, httpRes)
    } else {
      res.status(404).json({ error: 'Not found' })
    }
  }

  // Convert to callable
  return callableAdapter.convertHttpToCallable(httpHandler)
}

// For Firebase hosting rewrites (when using Functions with hosting)
export const createFirebaseRewriteFunction = (options: FirebaseMiddlewareOptions) => {
  // This is essentially the same as HTTP function but with different routing expectations
  return createFirebaseHttpFunction(options)
}

// Cloud Functions v2 support (with typed request/response)
export const createFirebaseV2Function = (options: FirebaseMiddlewareOptions) => {
  const adapter = new FirebaseAdapter()

  const genericRouter = createGenericMiddleware({
    ...options,
    adapter
  }) as any

  return {
    // For Cloud Functions v2, you might want to return the actual function factory
    // This is a simplified version
    handler: (req: any, res: any) => {
      try {
        const httpReq = adapter.adaptRequest(req)
        const httpRes = adapter.adaptResponse(res)

        const route = genericRouter.matchRoute(httpReq.method, httpReq.path)

        if (route) {
          httpReq.params = genericRouter.extractParams(route.path, httpReq.path)

          const executeMiddleware = async (index = 0) => {
            if (index < (route.middleware?.length || 0)) {
              const middleware = route.middleware![index]
              await middleware(httpReq, httpRes, () => executeMiddleware(index + 1))
            } else {
              await route.handler(httpReq, httpRes)
            }
          }

          executeMiddleware().catch((error) => {
            console.error('Firebase v2 function error:', error)
            if (!res.headersSent) {
              res.status(500).json({ error: 'Internal server error' })
            }
          })
        } else {
          res.status(404).json({ error: 'Not found' })
        }
      } catch (error) {
        console.error('Firebase v2 function error:', error)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' })
        }
      }
    }
  }
}

// Re-export utilities
export { validateRepoRequest, validateSessionRequest } from './generic-middleware'
