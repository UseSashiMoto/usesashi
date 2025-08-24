import { HttpAdapter, HttpRequest, HttpResponse, HttpHandler } from '../types/http'

// Generic Firebase Functions-like interfaces to avoid importing Firebase
interface FirebaseRequestLike {
  method: string
  url: string
  path?: string
  headers: Record<string, any>
  body: any
  query: Record<string, any>
  params?: Record<string, string>
  protocol?: string
  hostname?: string
  get?(name: string): string | undefined
}

interface FirebaseResponseLike {
  status(code: number): FirebaseResponseLike
  json(data: any): void
  send(data: any): void
  set(field: string, value: string): void
  get(field: string): string | undefined
  redirect(statusCode: number, url: string): void
  redirect(url: string): void
  type(contentType: string): void
  headersSent?: boolean
  end(chunk?: any): void
}

export class FirebaseAdapter implements HttpAdapter {
  adaptRequest(req: FirebaseRequestLike): HttpRequest {
    // Firebase Functions request might not have all Express properties
    const url = req.url
    const urlObj = new URL(url, `${req.protocol || 'https'}://${req.hostname || 'localhost'}`)
    
    return {
      method: req.method,
      url: url,
      path: req.path || urlObj.pathname,
      headers: req.headers,
      body: req.body,
      params: req.params || {},
      query: req.query || {},
      protocol: req.protocol || 'https',
      hostname: req.hostname || 'localhost'
    }
  }

  adaptResponse(res: FirebaseResponseLike): HttpResponse {
    return {
      status: (code: number) => {
        res.status(code)
        return this.adaptResponse(res) // Return for chaining
      },
      json: (data: any) => res.json(data),
      send: (data: string) => res.send(data),
      setHeader: (name: string, value: string) => res.set(name, value),
      getHeader: (name: string) => res.get(name),
      redirect: (url: string) => {
        // Firebase Functions redirect can take status code as first param
        if (typeof res.redirect === 'function') {
          res.redirect(url)
        }
      },
      type: (contentType: string) => res.type(contentType),
      headersSent: res.headersSent || false
    }
  }

  createHandler(httpHandler: HttpHandler) {
    return async (req: FirebaseRequestLike, res: FirebaseResponseLike) => {
      try {
        const httpReq = this.adaptRequest(req)
        const httpRes = this.adaptResponse(res)
        
        await Promise.resolve(httpHandler(httpReq, httpRes))
      } catch (error) {
        console.error('Firebase handler error:', error)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' })
        }
      }
    }
  }

  // Create a Cloud Function handler
  createCloudFunction(httpHandler: HttpHandler) {
    return this.createHandler(httpHandler)
  }
}

// For Firebase Callable Functions (different signature)
interface CallableDataLike {
  [key: string]: any
}

interface CallableContextLike {
  auth?: {
    uid: string
    token: any
  }
  rawRequest?: FirebaseRequestLike
}

export class FirebaseCallableAdapter {
  createCallableHandler(
    handler: (data: CallableDataLike, context: CallableContextLike) => Promise<any>
  ) {
    return async (data: CallableDataLike, context: CallableContextLike) => {
      try {
        return await handler(data, context)
      } catch (error) {
        console.error('Firebase Callable handler error:', error)
        throw new Error('Internal server error')
      }
    }
  }

  // Convert HTTP handler to callable handler
  convertHttpToCallable(httpHandler: HttpHandler) {
    return async (data: CallableDataLike, context: CallableContextLike) => {
      try {
        // Create mock HTTP request/response for callable functions
        const mockReq: HttpRequest = {
          method: 'POST',
          url: '/callable',
          path: '/callable',
          headers: {},
          body: data,
          params: {},
          query: {},
          protocol: 'https',
          hostname: 'localhost'
        }

        let responseData: any = null
        let statusCode = 200

        const mockRes: HttpResponse = {
          status: (code: number) => {
            statusCode = code
            return mockRes
          },
          json: (responseDataParam: any) => {
            responseData = responseDataParam
          },
          send: (responseDataParam: string) => {
            responseData = responseDataParam
          },
          setHeader: () => {},
          getHeader: () => undefined,
          redirect: () => {},
          type: () => {},
          headersSent: false
        }

        await Promise.resolve(httpHandler(mockReq, mockRes))

        if (statusCode >= 400) {
          throw new Error(responseData?.error || 'Request failed')
        }

        return responseData
      } catch (error) {
        console.error('Firebase Callable conversion error:', error)
        throw new Error('Internal server error')
      }
    }
  }
}