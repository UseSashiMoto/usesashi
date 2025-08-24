export interface HttpRequest {
  method: string
  url: string
  path: string
  headers: Record<string, string | string[] | undefined>
  body: any
  params: Record<string, string>
  query: Record<string, string | string[]>
  protocol: string
  hostname: string
  originalUrl?: string
}

export interface HttpResponse {
  status(code: number): HttpResponse
  json(data: any): void | Promise<void>
  send(data: string): void | Promise<void>
  setHeader(name: string, value: string): void
  getHeader(name: string): string | undefined
  redirect(url: string): void | Promise<void>
  type(contentType: string): void
  headersSent: boolean
}

export interface HttpAdapter {
  adaptRequest(originalRequest: any): HttpRequest
  adaptResponse(originalResponse: any): HttpResponse
  createHandler(handler: HttpHandler): any
}

export type HttpHandler = (req: HttpRequest, res: HttpResponse) => Promise<void> | void
export type HttpNextFunction = () => void | Promise<void>

export interface MiddlewareHandler {
  (req: HttpRequest, res: HttpResponse, next?: HttpNextFunction): Promise<void> | void
}

export interface RouteHandler {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS'
  path: string
  handler: MiddlewareHandler
  middleware?: MiddlewareHandler[]
  isMiddleware?: boolean // Flag to indicate this is a middleware route
}

export interface HttpRouter {
  get(path: string, ...handlers: MiddlewareHandler[]): void
  post(path: string, ...handlers: MiddlewareHandler[]): void
  put(path: string, ...handlers: MiddlewareHandler[]): void
  delete(path: string, ...handlers: MiddlewareHandler[]): void
  patch(path: string, ...handlers: MiddlewareHandler[]): void
  options(path: string, ...handlers: MiddlewareHandler[]): void
  use(pathOrHandler: string | MiddlewareHandler, ...handlers: MiddlewareHandler[]): void
  getRoutes(): RouteHandler[]
}

export interface HttpMiddleware {
  cors(options?: any): MiddlewareHandler
  bodyParser: {
    json(options?: any): MiddlewareHandler
    urlencoded(options?: any): MiddlewareHandler
  }
}