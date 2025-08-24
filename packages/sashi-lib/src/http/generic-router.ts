import { HttpRouter, MiddlewareHandler, RouteHandler } from '../types/http'

export class GenericRouter implements HttpRouter {
  private routes: RouteHandler[] = []
  private globalMiddleware: MiddlewareHandler[] = []

  get(path: string, ...handlers: MiddlewareHandler[]): void {
    this.addRoute('GET', path, handlers)
  }

  post(path: string, ...handlers: MiddlewareHandler[]): void {
    this.addRoute('POST', path, handlers)
  }

  put(path: string, ...handlers: MiddlewareHandler[]): void {
    this.addRoute('PUT', path, handlers)
  }

  delete(path: string, ...handlers: MiddlewareHandler[]): void {
    this.addRoute('DELETE', path, handlers)
  }

  patch(path: string, ...handlers: MiddlewareHandler[]): void {
    this.addRoute('PATCH', path, handlers)
  }

  options(path: string, ...handlers: MiddlewareHandler[]): void {
    this.addRoute('OPTIONS', path, handlers)
  }

  use(pathOrHandler: string | MiddlewareHandler, ...handlers: MiddlewareHandler[]): void {
    if (typeof pathOrHandler === 'string') {
      // Path-specific middleware - mark these specially
      const path = pathOrHandler
      handlers.forEach(handler => {
        this.routes.push({
          method: 'GET', // Middleware routes use GET as placeholder
          path,
          handler,
          middleware: [],
          isMiddleware: true // Add flag to distinguish middleware routes
        })
      })
    } else {
      // Global middleware
      this.globalMiddleware.push(pathOrHandler, ...handlers)
    }
  }

  getRoutes(): RouteHandler[] {
    return this.routes
  }

  getGlobalMiddleware(): MiddlewareHandler[] {
    return this.globalMiddleware
  }

  private addRoute(method: RouteHandler['method'], path: string, handlers: MiddlewareHandler[]): void {
    if (handlers.length === 0) {
      throw new Error(`No handlers provided for ${method} ${path}`)
    }

    const handler = handlers[handlers.length - 1]
    if (!handler) {
      throw new Error(`Invalid handler for ${method} ${path}`)
    }
    const middleware = handlers.slice(0, -1)

    this.routes.push({
      method,
      path,
      handler,
      middleware: [...this.globalMiddleware, ...middleware]
    })
  }

  // Helper method to match routes
  matchRoute(method: string, path: string): RouteHandler | undefined {
    return this.routes.find(route => {
      // For middleware routes, match if path starts with route path (any method)
      if (route.isMiddleware && path.startsWith(route.path)) {
        return true
      }
      // For specific routes, match method and exact path
      return route.method === method && this.pathMatches(route.path, path)
    })
  }

  private pathMatches(routePath: string, requestPath: string): boolean {
    // Simple path matching - can be enhanced with parameter support
    if (routePath === requestPath) {
      return true
    }

    // Support for parameter routes like /users/:id
    const routeParts = routePath.split('/')
    const requestParts = requestPath.split('/')

    if (routeParts.length !== requestParts.length) {
      return false
    }

    return routeParts.every((part, index) => {
      return part.startsWith(':') || part === requestParts[index]
    })
  }

  // Extract parameters from path
  extractParams(routePath: string, requestPath: string): Record<string, string> {
    const params: Record<string, string> = {}
    const routeParts = routePath.split('/')
    const requestParts = requestPath.split('/')

    routeParts.forEach((part, index) => {
      if (part.startsWith(':')) {
        const paramName = part.slice(1)
        params[paramName] = requestParts[index] || ''
      }
    })

    return params
  }
}