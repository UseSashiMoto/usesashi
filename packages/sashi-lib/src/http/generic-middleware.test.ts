import { GenericMiddleware, asyncHandler } from './generic-middleware'
import { HttpRequest, HttpResponse } from '../types/http'

describe('GenericMiddleware', () => {
  let middleware: GenericMiddleware
  let mockReq: HttpRequest
  let mockRes: HttpResponse
  let mockNext: jest.MockedFunction<() => void>

  beforeEach(() => {
    middleware = new GenericMiddleware()
    mockReq = {
      method: 'GET',
      url: '/test',
      path: '/test',
      headers: {},
      body: undefined,
      params: {},
      query: {},
      protocol: 'http',
      hostname: 'localhost'
    }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      redirect: jest.fn(),
      type: jest.fn(),
      headersSent: false
    }
    mockNext = jest.fn()
  })

  describe('CORS Middleware', () => {
    it('should set default CORS headers', async () => {
      const corsHandler = middleware.cors()
      
      await corsHandler(mockReq, mockRes, mockNext)
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, x-api-token, x-sashi-session-token')
      expect(mockNext).toHaveBeenCalled()
    })

    it('should set custom origin', async () => {
      const corsHandler = middleware.cors({ origin: 'https://example.com' })
      
      await corsHandler(mockReq, mockRes, mockNext)
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com')
    })

    it('should handle array of origins', async () => {
      mockReq.headers.origin = 'https://allowed.com'
      const corsHandler = middleware.cors({ origin: ['https://allowed.com', 'https://other.com'] })
      
      await corsHandler(mockReq, mockRes, mockNext)
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://allowed.com')
    })

    it('should set credentials header when enabled', async () => {
      const corsHandler = middleware.cors({ credentials: true })
      
      await corsHandler(mockReq, mockRes, mockNext)
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true')
    })

    it('should handle OPTIONS preflight requests', async () => {
      mockReq.method = 'OPTIONS'
      const corsHandler = middleware.cors()
      
      await corsHandler(mockReq, mockRes, mockNext)
      
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.send).toHaveBeenCalledWith('')
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should call next for non-OPTIONS requests', async () => {
      mockReq.method = 'GET'
      const corsHandler = middleware.cors()
      
      await corsHandler(mockReq, mockRes, mockNext)
      
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('JSON Body Parser', () => {
    it('should skip parsing if body is already parsed', async () => {
      mockReq.body = { test: 'data' }
      const jsonHandler = middleware.bodyParser.json()
      
      await jsonHandler(mockReq, mockRes, mockNext)
      
      expect(mockReq.body).toEqual({ test: 'data' })
      expect(mockNext).toHaveBeenCalled()
    })

    it('should parse JSON string body', async () => {
      mockReq.body = '{"test": "data"}'
      const jsonHandler = middleware.bodyParser.json()
      
      await jsonHandler(mockReq, mockRes, mockNext)
      
      expect(mockReq.body).toEqual({ test: 'data' })
      expect(mockNext).toHaveBeenCalled()
    })

    it('should handle invalid JSON', async () => {
      mockReq.body = '{"invalid": json}'
      const jsonHandler = middleware.bodyParser.json()
      
      await jsonHandler(mockReq, mockRes, mockNext)
      
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid JSON' })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should handle undefined body', async () => {
      mockReq.body = undefined
      const jsonHandler = middleware.bodyParser.json()
      
      await jsonHandler(mockReq, mockRes, mockNext)
      
      expect(mockNext).toHaveBeenCalled()
    })

    it('should accept custom options', async () => {
      const jsonHandler = middleware.bodyParser.json({ limit: '10mb' })
      mockReq.body = { test: 'data' }
      
      await jsonHandler(mockReq, mockRes, mockNext)
      
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('URL Encoded Body Parser', () => {
    it('should skip parsing if body is already parsed', async () => {
      mockReq.body = { test: 'data' }
      const urlencodedHandler = middleware.bodyParser.urlencoded()
      
      await urlencodedHandler(mockReq, mockRes, mockNext)
      
      expect(mockReq.body).toEqual({ test: 'data' })
      expect(mockNext).toHaveBeenCalled()
    })

    it('should handle undefined body', async () => {
      mockReq.body = undefined
      const urlencodedHandler = middleware.bodyParser.urlencoded()
      
      await urlencodedHandler(mockReq, mockRes, mockNext)
      
      expect(mockNext).toHaveBeenCalled()
    })

    it('should accept custom options', async () => {
      const urlencodedHandler = middleware.bodyParser.urlencoded({ extended: false })
      mockReq.body = { test: 'data' }
      
      await urlencodedHandler(mockReq, mockRes, mockNext)
      
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('asyncHandler', () => {
    it('should handle successful async functions', async () => {
      const asyncFn = jest.fn().mockResolvedValue(undefined)
      const handler = asyncHandler(asyncFn)
      
      await handler(mockReq, mockRes, mockNext)
      
      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext)
    })

    it('should handle async function errors', async () => {
      const error = new Error('Test error')
      const asyncFn = jest.fn().mockRejectedValue(error)
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const handler = asyncHandler(asyncFn)
      
      await handler(mockReq, mockRes, mockNext)
      
      expect(consoleSpy).toHaveBeenCalledWith('Async handler error:', error)
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' })
      
      consoleSpy.mockRestore()
    })

    it('should not send error response if headers already sent', async () => {
      const error = new Error('Test error')
      const asyncFn = jest.fn().mockRejectedValue(error)
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockRes.headersSent = true
      
      const handler = asyncHandler(asyncFn)
      
      await handler(mockReq, mockRes, mockNext)
      
      expect(consoleSpy).toHaveBeenCalledWith('Async handler error:', error)
      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockRes.json).not.toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should handle synchronous functions', async () => {
      const syncFn = jest.fn()
      const handler = asyncHandler(syncFn)
      
      await handler(mockReq, mockRes, mockNext)
      
      expect(syncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext)
    })

    it('should handle synchronous function errors', async () => {
      const error = new Error('Test error')
      const syncFn = jest.fn().mockImplementation(() => { throw error })
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const handler = asyncHandler(syncFn)
      
      await handler(mockReq, mockRes, mockNext)
      
      expect(consoleSpy).toHaveBeenCalledWith('Async handler error:', error)
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' })
      
      consoleSpy.mockRestore()
    })
  })
})