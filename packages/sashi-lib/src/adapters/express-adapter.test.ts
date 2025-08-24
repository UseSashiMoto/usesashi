import { ExpressAdapter } from './express-adapter'
import { HttpRequest, HttpResponse } from '../types/http'

// Mock Express types for testing without adding Express dependency
interface MockExpressRequest {
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
  get(name: string): string | undefined
}

interface MockExpressResponse {
  status(code: number): MockExpressResponse
  json(data: any): void
  send(data: string): void
  setHeader(name: string, value: string): void
  getHeader(name: string): string | undefined
  redirect(url: string): void
  type(contentType: string): void
  headersSent: boolean
}

describe('ExpressAdapter', () => {
  let adapter: ExpressAdapter
  let mockExpressReq: MockExpressRequest
  let mockExpressRes: MockExpressResponse

  beforeEach(() => {
    adapter = new ExpressAdapter()
    
    mockExpressReq = {
      method: 'GET',
      url: '/test?param=value',
      path: '/test',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer token123'
      },
      body: { data: 'test' },
      params: { id: '123' },
      query: { param: 'value' },
      protocol: 'https',
      hostname: 'example.com',
      originalUrl: '/original/test',
      get: jest.fn((name: string) => {
        const headers: Record<string, string> = {
          'host': 'example.com',
          'user-agent': 'test-agent'
        }
        return headers[name.toLowerCase()]
      })
    }

    mockExpressRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      redirect: jest.fn(),
      type: jest.fn(),
      headersSent: false
    }
  })

  describe('adaptRequest', () => {
    it('should adapt Express request to HttpRequest', () => {
      const httpReq: HttpRequest = adapter.adaptRequest(mockExpressReq)

      expect(httpReq.method).toBe('GET')
      expect(httpReq.url).toBe('/test?param=value')
      expect(httpReq.path).toBe('/test')
      expect(httpReq.headers).toEqual(mockExpressReq.headers)
      expect(httpReq.body).toEqual(mockExpressReq.body)
      expect(httpReq.params).toEqual(mockExpressReq.params)
      expect(httpReq.query).toEqual(mockExpressReq.query)
      expect(httpReq.protocol).toBe('https')
      expect(httpReq.hostname).toBe('example.com')
      expect(httpReq.originalUrl).toBe('/original/test')
    })

    it('should handle missing optional properties', () => {
      const minimalExpressReq = {
        method: 'POST',
        url: '/minimal',
        path: '/minimal',
        headers: {},
        body: null,
        params: {},
        query: {},
        protocol: 'http',
        hostname: 'localhost',
        get: jest.fn()
      }

      const httpReq: HttpRequest = adapter.adaptRequest(minimalExpressReq)

      expect(httpReq.method).toBe('POST')
      expect(httpReq.url).toBe('/minimal')
      expect(httpReq.originalUrl).toBeUndefined()
    })

    it('should preserve all header types', () => {
      mockExpressReq.headers = {
        'single-header': 'value',
        'array-header': ['value1', 'value2'],
        'undefined-header': undefined
      }

      const httpReq: HttpRequest = adapter.adaptRequest(mockExpressReq)

      expect(httpReq.headers['single-header']).toBe('value')
      expect(httpReq.headers['array-header']).toEqual(['value1', 'value2'])
      expect(httpReq.headers['undefined-header']).toBeUndefined()
    })
  })

  describe('adaptResponse', () => {
    it('should adapt Express response to HttpResponse', () => {
      const httpRes: HttpResponse = adapter.adaptResponse(mockExpressRes)

      expect(typeof httpRes.status).toBe('function')
      expect(typeof httpRes.json).toBe('function')
      expect(typeof httpRes.send).toBe('function')
      expect(typeof httpRes.setHeader).toBe('function')
      expect(typeof httpRes.getHeader).toBe('function')
      expect(typeof httpRes.redirect).toBe('function')
      expect(typeof httpRes.type).toBe('function')
      expect(httpRes.headersSent).toBe(false)
    })

    it('should forward status calls', () => {
      const httpRes: HttpResponse = adapter.adaptResponse(mockExpressRes)
      
      const result = httpRes.status(404)
      
      expect(mockExpressRes.status).toHaveBeenCalledWith(404)
      expect(result).toBe(httpRes) // Should return itself for chaining
    })

    it('should forward json calls', () => {
      const httpRes: HttpResponse = adapter.adaptResponse(mockExpressRes)
      const data = { message: 'test' }
      
      httpRes.json(data)
      
      expect(mockExpressRes.json).toHaveBeenCalledWith(data)
    })

    it('should forward send calls', () => {
      const httpRes: HttpResponse = adapter.adaptResponse(mockExpressRes)
      
      httpRes.send('test response')
      
      expect(mockExpressRes.send).toHaveBeenCalledWith('test response')
    })

    it('should forward setHeader calls', () => {
      const httpRes: HttpResponse = adapter.adaptResponse(mockExpressRes)
      
      httpRes.setHeader('Content-Type', 'application/json')
      
      expect(mockExpressRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
    })

    it('should forward getHeader calls', () => {
      mockExpressRes.getHeader = jest.fn().mockReturnValue('application/json')
      const httpRes: HttpResponse = adapter.adaptResponse(mockExpressRes)
      
      const result = httpRes.getHeader('Content-Type')
      
      expect(mockExpressRes.getHeader).toHaveBeenCalledWith('Content-Type')
      expect(result).toBe('application/json')
    })

    it('should forward redirect calls', () => {
      const httpRes: HttpResponse = adapter.adaptResponse(mockExpressRes)
      
      httpRes.redirect('/new-url')
      
      expect(mockExpressRes.redirect).toHaveBeenCalledWith('/new-url')
    })

    it('should forward type calls', () => {
      const httpRes: HttpResponse = adapter.adaptResponse(mockExpressRes)
      
      httpRes.type('text/html')
      
      expect(mockExpressRes.type).toHaveBeenCalledWith('text/html')
    })

    it('should preserve headersSent property', () => {
      mockExpressRes.headersSent = true
      const httpRes: HttpResponse = adapter.adaptResponse(mockExpressRes)
      
      expect(httpRes.headersSent).toBe(true)
    })
  })

  describe('createHandler', () => {
    it('should create Express-compatible handler', () => {
      const mockHttpHandler = jest.fn()
      const expressHandler = adapter.createHandler(mockHttpHandler)
      
      expect(typeof expressHandler).toBe('function')
    })

    it('should adapt request and response in handler', async () => {
      const mockHttpHandler = jest.fn()
      const mockNext = jest.fn()
      const expressHandler = adapter.createHandler(mockHttpHandler)
      
      await expressHandler(mockExpressReq, mockExpressRes, mockNext)
      
      expect(mockHttpHandler).toHaveBeenCalled()
      
      // Verify the adapted objects were passed
      const [httpReq, httpRes] = mockHttpHandler.mock.calls[0]
      expect(httpReq.method).toBe(mockExpressReq.method)
      expect(httpReq.url).toBe(mockExpressReq.url)
      expect(typeof httpRes.status).toBe('function')
    })

    it('should handle async http handlers', async () => {
      const mockHttpHandler = jest.fn().mockResolvedValue(undefined)
      const mockNext = jest.fn()
      const expressHandler = adapter.createHandler(mockHttpHandler)
      
      await expressHandler(mockExpressReq, mockExpressRes, mockNext)
      
      expect(mockHttpHandler).toHaveBeenCalled()
    })

    it('should handle http handler errors', async () => {
      const error = new Error('Test error')
      const mockHttpHandler = jest.fn().mockRejectedValue(error)
      const mockNext = jest.fn()
      const expressHandler = adapter.createHandler(mockHttpHandler)
      
      await expressHandler(mockExpressReq, mockExpressRes, mockNext)
      
      expect(mockNext).toHaveBeenCalledWith(error)
    })

    it('should call next when provided', async () => {
      const mockHttpHandler = jest.fn((req, res, next) => {
        if (next) next()
      })
      const mockNext = jest.fn()
      const expressHandler = adapter.createHandler(mockHttpHandler)
      
      await expressHandler(mockExpressReq, mockExpressRes, mockNext)
      
      expect(mockNext).toHaveBeenCalled()
    })
  })
})