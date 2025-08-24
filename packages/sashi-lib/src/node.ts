// Native Node.js HTTP server entry point
import * as http from 'http'
import * as https from 'https'
import * as querystring from 'querystring'
import * as url from 'url'
import { createGenericMiddleware, GenericMiddlewareOptions } from './generic-middleware'
import { HttpAdapter, HttpHandler, HttpRequest, HttpResponse } from './types/http'

// Node.js HTTP adapter for native http.IncomingMessage and http.ServerResponse
class NodeHttpAdapter implements HttpAdapter {
  adaptRequest(req: http.IncomingMessage): HttpRequest {
    const parsedUrl = url.parse(req.url || '/', true)
    const protocol = (req.socket as any)?.encrypted ? 'https' : 'http'

    return {
      method: req.method || 'GET',
      url: req.url || '/',
      path: parsedUrl.pathname || '/',
      headers: req.headers,
      body: (req as any).body, // Will be set by body parser
      params: {}, // Will be set by router
      query: (parsedUrl.query || {}) as Record<string, string | string[]>,
      protocol,
      hostname: req.headers.host?.split(':')[0] || 'localhost'
    }
  }

  adaptResponse(res: http.ServerResponse): HttpResponse {
    return {
      status: (code: number) => {
        res.statusCode = code
        return this.adaptResponse(res)
      },
      json: (data: any) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(data))
      },
      send: (data: string) => {
        res.end(data)
      },
      setHeader: (name: string, value: string) => {
        res.setHeader(name, value)
      },
      getHeader: (name: string) => {
        const header = res.getHeader(name)
        return typeof header === 'string' ? header : undefined
      },
      redirect: (location: string) => {
        res.statusCode = 302
        res.setHeader('Location', location)
        res.end()
      },
      type: (contentType: string) => {
        res.setHeader('Content-Type', contentType)
      },
      headersSent: res.headersSent
    }
  }

  createHandler(httpHandler: HttpHandler) {
    return async (req: http.IncomingMessage, res: http.ServerResponse) => {
      try {
        const httpReq = this.adaptRequest(req)
        const httpRes = this.adaptResponse(res)

        await Promise.resolve(httpHandler(httpReq, httpRes))
      } catch (error) {
        console.error('Node.js handler error:', error)
        if (!res.headersSent) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      }
    }
  }
}

// Re-export types that Node.js users might need
export { HttpRequest, HttpResponse, MiddlewareHandler } from './types/http'

// Node.js-specific middleware options
export interface NodeMiddlewareOptions extends Omit<GenericMiddlewareOptions, 'adapter'> {
  // Node.js-specific options
  bodyLimit?: string
  parseBody?: boolean
}

// Body parser for raw Node.js requests
const parseBody = async (req: http.IncomingMessage): Promise<any> => {
  return new Promise((resolve, reject) => {
    let body = ''

    req.on('data', (chunk) => {
      body += chunk.toString()
    })

    req.on('end', () => {
      try {
        const contentType = req.headers['content-type'] || ''

        if (contentType.includes('application/json')) {
          resolve(body ? JSON.parse(body) : {})
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          resolve(querystring.parse(body))
        } else {
          resolve(body)
        }
      } catch (error) {
        reject(new Error('Failed to parse request body'))
      }
    })

    req.on('error', reject)
  })
}

// Create Node.js HTTP handler
export const createNodeHttpHandler = (options: NodeMiddlewareOptions) => {
  const adapter = new NodeHttpAdapter()

  const genericRouter = createGenericMiddleware({
    ...options,
    adapter
  }) as any

  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    try {
      // Parse body if enabled
      if (options.parseBody !== false) {
        try {
          (req as any).body = await parseBody(req)
        } catch (error) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Invalid request body' }))
          return
        }
      }

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
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Not found' }))
      }
    } catch (error) {
      console.error('Node.js HTTP handler error:', error)
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Internal server error' }))
      }
    }
  }
}

// Create a complete HTTP server
export const createNodeHttpServer = (
  options: NodeMiddlewareOptions,
  serverOptions?: http.ServerOptions
) => {
  const handler = createNodeHttpHandler(options)
  return http.createServer(serverOptions || {}, handler)
}

// Create a complete HTTPS server
export const createNodeHttpsServer = (
  options: NodeMiddlewareOptions,
  serverOptions: https.ServerOptions
) => {
  const handler = createNodeHttpHandler(options)
  return https.createServer(serverOptions, handler)
}

// Convenience function to start a server
export const startServer = (
  options: NodeMiddlewareOptions & {
    port?: number
    hostname?: string
    https?: https.ServerOptions
  }
) => {
  const { port = 3000, hostname = 'localhost', https: httpsOptions, ...middlewareOptions } = options

  const server = httpsOptions
    ? createNodeHttpsServer(middlewareOptions, httpsOptions)
    : createNodeHttpServer(middlewareOptions)

  return new Promise<http.Server | https.Server>((resolve, reject) => {
    server.listen(port, hostname, () => {
      console.log(`Sashi server listening on ${httpsOptions ? 'https' : 'http'}://${hostname}:${port}`)
      resolve(server)
    })

    server.on('error', reject)
  })
}

// Re-export utilities
export { validateRepoRequest, validateSessionRequest } from './generic-middleware'
