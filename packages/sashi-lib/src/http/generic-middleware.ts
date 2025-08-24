import { HttpMiddleware, MiddlewareHandler, HttpRequest, HttpResponse, HttpNextFunction } from '../types/http'

export class GenericMiddleware implements HttpMiddleware {
  cors(options: any = {}): MiddlewareHandler {
    const {
      origin = '*',
      methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders = ['Content-Type', 'x-api-token', 'x-sashi-session-token'],
      credentials = false
    } = options

    return async (req: HttpRequest, res: HttpResponse, next?: HttpNextFunction) => {
      // Set CORS headers
      if (typeof origin === 'string') {
        res.setHeader('Access-Control-Allow-Origin', origin)
      } else if (Array.isArray(origin)) {
        const requestOrigin = req.headers.origin as string
        if (origin.includes(requestOrigin)) {
          res.setHeader('Access-Control-Allow-Origin', requestOrigin)
        }
      }

      res.setHeader('Access-Control-Allow-Methods', methods.join(', '))
      res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '))
      
      if (credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true')
      }

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(200).send('')
        return
      }

      if (next) {
        next()
      }
    }
  }

  bodyParser = {
    json: (options: any = {}): MiddlewareHandler => {
      const { limit = '1mb' } = options

      return async (req: HttpRequest, res: HttpResponse, next?: HttpNextFunction) => {
        try {
          // Check if body is already parsed
          if (req.body !== undefined) {
            if (next) next()
            return
          }

          // For test environments or when body is already a string/object
          if (typeof req.body === 'string') {
            try {
              req.body = JSON.parse(req.body)
              if (next) next()
              return
            } catch (e) {
              res.status(400).json({ error: 'Invalid JSON' })
              return
            }
          } else if (typeof req.body === 'object' && req.body !== null) {
            // Body is already parsed
            if (next) next()
            return
          }

          // If we get here, body parsing should have been handled by the adapter
          if (next) next()
        } catch (error) {
          res.status(400).json({ error: 'Failed to parse JSON body' })
        }
      }
    },

    urlencoded: (options: any = {}): MiddlewareHandler => {
      const { extended = true } = options

      return async (req: HttpRequest, res: HttpResponse, next?: HttpNextFunction) => {
        try {
          // Check if body is already parsed
          if (req.body !== undefined) {
            if (next) next()
            return
          }

          // URL encoding parsing should be handled by the adapter
          // This is a placeholder for the generic implementation
          if (next) next()
        } catch (error) {
          res.status(400).json({ error: 'Failed to parse URL encoded body' })
        }
      }
    }
  }
}

// Utility function to create async handler wrapper
export const asyncHandler = (fn: MiddlewareHandler): MiddlewareHandler => {
  return async (req: HttpRequest, res: HttpResponse, next?: HttpNextFunction) => {
    try {
      await Promise.resolve(fn(req, res, next))
    } catch (error) {
      // In a real implementation, you might want to pass this to an error handler
      console.error('Async handler error:', error)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  }
}