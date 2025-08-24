import { HttpAdapter, HttpRequest, HttpResponse, HttpHandler } from '../types/http'

// Generic Next.js-like interfaces to avoid importing Next.js
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

// For App Router (Web API Request/Response)
interface WebRequestLike {
  method: string
  url: string
  headers: {
    get(name: string): string | null
    forEach(callback: (value: string, key: string) => void): void
  }
  json(): Promise<any>
  text(): Promise<string>
  formData(): Promise<FormData>
}

interface WebResponseLike {
  new (body?: any, init?: ResponseInit): WebResponseLike
  json(data: any): WebResponseLike
  redirect(url: string, status?: number): WebResponseLike
  headers: {
    set(name: string, value: string): void
    get(name: string): string | null
  }
  status: number
  ok: boolean
}

export class NextApiAdapter implements HttpAdapter {
  adaptRequest(req: NextApiRequestLike): HttpRequest {
    // Extract path from URL or use default
    const url = req.url || '/'
    const urlObj = new URL(url, 'http://localhost')
    
    return {
      method: req.method || 'GET',
      url: url,
      path: urlObj.pathname,
      headers: req.headers,
      body: req.body,
      params: {}, // Next.js params are usually in query
      query: req.query,
      protocol: 'http', // Next.js doesn't expose protocol directly
      hostname: 'localhost' // Default, can be enhanced
    }
  }

  adaptResponse(res: NextApiResponseLike): HttpResponse {
    return {
      status: (code: number) => {
        res.status(code)
        return this.adaptResponse(res) // Return for chaining
      },
      json: (data: any) => res.json(data),
      send: (data: string) => res.send(data),
      setHeader: (name: string, value: string) => res.setHeader(name, value),
      getHeader: (name: string) => {
        const header = res.getHeader(name)
        return typeof header === 'string' ? header : undefined
      },
      redirect: (url: string) => res.redirect(url),
      type: (contentType: string) => res.setHeader('Content-Type', contentType),
      headersSent: res.headersSent || false
    }
  }

  createHandler(httpHandler: HttpHandler) {
    return async (req: NextApiRequestLike, res: NextApiResponseLike) => {
      try {
        const httpReq = this.adaptRequest(req)
        const httpRes = this.adaptResponse(res)
        
        await Promise.resolve(httpHandler(httpReq, httpRes))
      } catch (error) {
        console.error('Next.js handler error:', error)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' })
        }
      }
    }
  }
}

export class NextAppRouterAdapter implements HttpAdapter {
  adaptRequest(req: WebRequestLike): HttpRequest {
    const urlObj = new URL(req.url)
    const headers: Record<string, string | string[]> = {}
    
    // Convert Headers to plain object
    req.headers.forEach((value, key) => {
      headers[key] = value
    })

    // Extract query parameters
    const query: Record<string, string | string[]> = {}
    urlObj.searchParams.forEach((value, key) => {
      const existing = query[key]
      if (existing) {
        query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value]
      } else {
        query[key] = value
      }
    })

    return {
      method: req.method,
      url: req.url,
      path: urlObj.pathname,
      headers,
      body: undefined, // Will be set by body parsing middleware
      params: {}, // Would need route matching for dynamic routes
      query,
      protocol: urlObj.protocol.slice(0, -1), // Remove trailing ':'
      hostname: urlObj.hostname
    }
  }

  adaptResponse(_res: WebResponseLike): HttpResponse {
    let responseData: any = null
    let statusCode = 200
    const responseHeaders: Record<string, string> = {}

    return {
      status: (code: number) => {
        statusCode = code
        return this.adaptResponse(_res) // Return for chaining
      },
      json: (data: any) => {
        responseData = data
        responseHeaders['Content-Type'] = 'application/json'
        // In a real implementation, this would trigger response creation
      },
      send: (data: string) => {
        responseData = data
        // In a real implementation, this would trigger response creation
      },
      setHeader: (name: string, value: string) => {
        responseHeaders[name] = value
      },
      getHeader: (name: string) => responseHeaders[name],
      redirect: (url: string) => {
        statusCode = 302
        responseHeaders['Location'] = url
        // In a real implementation, this would create redirect response
      },
      type: (contentType: string) => {
        responseHeaders['Content-Type'] = contentType
      },
      headersSent: false
    }
  }

  createHandler(httpHandler: HttpHandler) {
    return async (req: WebRequestLike) => {
      try {
        const httpReq = this.adaptRequest(req)
        
        // Create a response builder
        let responseData: any = null
        let statusCode = 200
        const responseHeaders: Record<string, string> = {}

        const httpRes: HttpResponse = {
          status: (code: number) => {
            statusCode = code
            return httpRes
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

        await Promise.resolve(httpHandler(httpReq, httpRes))

        // Create Response object
        const init: ResponseInit = {
          status: statusCode,
          headers: responseHeaders
        }

        if (responseHeaders['Location']) {
          // Redirect response
          return new Response(null, init)
        } else if (responseData !== null) {
          const body = typeof responseData === 'string' 
            ? responseData 
            : JSON.stringify(responseData)
          return new Response(body, init)
        } else {
          return new Response(null, init)
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
}