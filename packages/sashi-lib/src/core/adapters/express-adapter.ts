/**
 * Express Framework Adapter for Sashi Core
 * Converts between Express req/res and Web Standards Request/Response
 */

import { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express'
import { FrameworkAdapter, SashiCore, SashiContext } from '../types'

export class ExpressAdapter implements FrameworkAdapter<ExpressRequest, ExpressResponse> {
  
  toWebRequest(req: ExpressRequest): Request {
    // Build full URL
    const protocol = req.protocol || 'http'
    const host = req.get('host') || 'localhost'
    const url = `${protocol}://${host}${req.originalUrl || req.url}`
    
    // Convert headers
    const headers = new Headers()
    Object.entries(req.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers.set(key, value)
      } else if (Array.isArray(value)) {
        // For multiple headers with same name, set first one
        if (value.length > 0) {
          headers.set(key, value[0])
        }
      }
    })
    
    // Handle request body for POST/PUT/PATCH
    let body: BodyInit | null = null
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (req.body !== undefined) {
        // Body is already parsed by Express middleware
        body = JSON.stringify(req.body)
        headers.set('content-type', 'application/json')
      }
    }
    
    // Create Web Standards Request
    return new Request(url, {
      method: req.method,
      headers,
      body
    })
  }
  
  extractContext(req: ExpressRequest): Partial<SashiContext> {
    const url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl || req.url}`)
    
    // Extract query parameters
    const query: Record<string, string | string[]> = {}
    Object.entries(req.query).forEach(([key, value]) => {
      if (typeof value === 'string') {
        query[key] = value
      } else if (Array.isArray(value)) {
        query[key] = value.map(v => String(v))
      } else if (value !== undefined) {
        query[key] = String(value)
      }
    })
    
    return {
      params: req.params || {},
      query,
      sessionId: req.headers['x-sashi-session-token'] as string,
      userId: req.headers['x-user-id'] as string,
      metadata: {
        originalRequest: req
      }
    }
  }
  
  async fromWebResponse(response: Response, res: ExpressResponse): Promise<ExpressResponse> {
    // Set status
    res.status(response.status)
    
    // Set headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })
    
    // Handle different response types
    const contentType = response.headers.get('content-type') || ''
    
    if (contentType.includes('application/json')) {
      const data = await response.json()
      res.json(data)
    } else if (contentType.includes('text/')) {
      const text = await response.text()
      res.send(text)
    } else if (response.status === 302 || response.status === 301) {
      // Handle redirects
      const location = response.headers.get('location')
      if (location) {
        res.redirect(location)
      } else {
        res.status(response.status).end()
      }
    } else {
      // Handle other types or empty responses
      const buffer = await response.arrayBuffer()
      if (buffer.byteLength > 0) {
        res.send(Buffer.from(buffer))
      } else {
        res.end()
      }
    }
    
    return res as any // Return Express response (not Web Standards)
  }
  
  createHandler(core: SashiCore) {
    return async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
      try {
        // Convert Express request to Web Standards
        const webRequest = this.toWebRequest(req)
        const context = this.extractContext(req)
        
        // Process with core
        const webResponse = await core.handleRequest(webRequest, context)
        
        // Convert back to Express response
        await this.fromWebResponse(webResponse, res)
      } catch (error) {
        console.error('Express adapter error:', error)
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Internal server error',
            message: 'An unexpected error occurred in the Express adapter'
          })
        }
      }
    }
  }
}

/**
 * Factory function for creating Express middleware from Sashi core
 */
export function createExpressMiddleware(core: SashiCore) {
  const adapter = new ExpressAdapter()
  return adapter.createHandler(core)
}
