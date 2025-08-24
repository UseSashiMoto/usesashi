import { HttpAdapter, HttpHandler, HttpRequest, HttpResponse } from '../types/http'

// Generic Express-like interfaces to avoid importing Express
interface ExpressLikeRequest {
  method: string
  url: string
  path: string
  headers: Record<string, any>
  body: any
  params: Record<string, string>
  query: Record<string, any>
  protocol: string
  hostname: string
  originalUrl?: string
  get?(name: string): string | undefined
}

interface ExpressLikeResponse {
  status(code: number): ExpressLikeResponse
  json(data: any): void
  send(data: string): void
  setHeader(name: string, value: string): void
  getHeader(name: string): string | undefined
  redirect(url: string): void
  type(contentType: string): void
  headersSent: boolean
}

type ExpressNextFunction = (error?: any) => void

export class ExpressAdapter implements HttpAdapter {
  adaptRequest(req: ExpressLikeRequest): HttpRequest {
    return {
      method: req.method,
      url: req.url,
      path: req.path,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
      protocol: req.protocol,
      hostname: req.hostname,
      originalUrl: req.originalUrl
    }
  }

  adaptResponse(res: ExpressLikeResponse): HttpResponse {
    return {
      status: (code: number) => {
        res.status(code)
        return this.adaptResponse(res) // Return adapted response for chaining
      },
      json: (data: any) => res.json(data),
      send: (data: string) => res.send(data),
      setHeader: (name: string, value: string) => res.setHeader(name, value),
      getHeader: (name: string) => res.getHeader(name),
      redirect: (url: string) => res.redirect(url),
      type: (contentType: string) => res.type(contentType),
      headersSent: res.headersSent
    }
  }

  createHandler(httpHandler: HttpHandler) {
    return async (req: ExpressLikeRequest, res: ExpressLikeResponse, next: ExpressNextFunction) => {
      try {
        const httpReq = this.adaptRequest(req)
        const httpRes = this.adaptResponse(res)

        await Promise.resolve(httpHandler(httpReq, httpRes))
      } catch (error) {
        next(error)
      }
    }
  }

  // Helper method to create router-compatible handlers
  createRouterHandler(httpHandler: HttpHandler) {
    return this.createHandler(httpHandler)
  }
}