import { createGenericMiddleware } from './generic-middleware'
import { HttpRequest, HttpResponse, HttpAdapter } from './types/http'

// Mock adapter for testing
class MockAdapter implements HttpAdapter {
  adaptRequest(originalRequest: any): HttpRequest {
    return {
      method: originalRequest.method || 'GET',
      url: originalRequest.url || '/',
      path: originalRequest.path || '/',
      headers: originalRequest.headers || {},
      body: originalRequest.body,
      params: originalRequest.params || {},
      query: originalRequest.query || {},
      protocol: originalRequest.protocol || 'http',
      hostname: originalRequest.hostname || 'localhost'
    }
  }

  adaptResponse(originalResponse: any): HttpResponse {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      redirect: jest.fn(),
      type: jest.fn(),
      headersSent: false
    }
  }

  createHandler(handler: any) {
    return handler
  }
}

// Mock all external dependencies
jest.mock('./ai-function-loader', () => ({
  getFunctionRegistry: jest.fn(() => new Map()),
  getFunctionAttributes: jest.fn(() => new Map()),
  toggleFunctionActive: jest.fn(),
  callFunctionFromRegistryFromObject: jest.fn()
}))

jest.mock('./aibot', () => ({
  createAIBot: jest.fn(),
  getAIBot: jest.fn(() => ({
    chatCompletion: jest.fn()
  }))
}))

jest.mock('./sashiagent', () => ({
  getSashiAgent: jest.fn(() => ({
    processRequest: jest.fn()
  }))
}))

jest.mock('@openai/agents', () => ({
  setDefaultOpenAIKey: jest.fn()
}))

jest.mock('./chat', () => ({
  processChatRequest: jest.fn()
}))

jest.mock('./github-api-service', () => ({
  getGithubConfig: jest.fn()
}))

jest.mock('./utils', () => ({
  createSashiHtml: jest.fn(() => '<html>Mock HTML</html>'),
  createSessionToken: jest.fn(() => 'mock-session-token'),
  ensureUrlProtocol: jest.fn((url) => url.startsWith('http') ? url : `https://${url}`)
}))

// Mock Sentry
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn()
}))

describe('createGenericMiddleware', () => {
  let mockAdapter: MockAdapter
  let mockOptions: any

  beforeEach(() => {
    mockAdapter = new MockAdapter()
    mockOptions = {
      openAIKey: 'test-openai-key',
      debug: true,
      adapter: mockAdapter,
      apiSecretKey: 'test-secret-key',
      hubUrl: 'https://test-hub.com'
    }

    // Clear all mocks
    jest.clearAllMocks()
  })

  describe('Router Creation', () => {
    it('should create a generic router', () => {
      const router = createGenericMiddleware(mockOptions)
      
      expect(router).toBeDefined()
      expect(typeof router.get).toBe('function')
      expect(typeof router.post).toBe('function')
      expect(typeof (router as any).matchRoute).toBe('function')
    })

    it('should register basic routes', () => {
      const router = createGenericMiddleware(mockOptions)
      const routes = router.getRoutes()
      
      // Should have some built-in routes
      expect(routes.length).toBeGreaterThan(0)
      
      // Check for expected routes
      const routePaths = routes.map(route => route.path)
      expect(routePaths).toContain('/sanity-check')
      expect(routePaths).toContain('/ping')
      expect(routePaths).toContain('/metadata')
    })
  })

  describe('Route Handlers', () => {
    let router: any
    let mockReq: HttpRequest
    let mockRes: HttpResponse

    beforeEach(() => {
      router = createGenericMiddleware(mockOptions)
      mockReq = {
        method: 'GET',
        url: '/sanity-check',
        path: '/sanity-check',
        headers: {},
        body: {},
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
    })

    it('should handle sanity check route', async () => {
      const route = (router as any).matchRoute('GET', '/sanity-check')
      expect(route).toBeDefined()
      
      if (route) {
        await route.handler(mockReq, mockRes)
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Sashi Middleware is running' })
      }
    })

    it('should handle ping route with valid API token', async () => {
      mockReq.path = '/ping'
      mockReq.headers[mockOptions.apiSecretKey] = mockOptions.apiSecretKey
      
      const route = (router as any).matchRoute('GET', '/ping')
      expect(route).toBeDefined()
      
      if (route) {
        await route.handler(mockReq, mockRes)
        expect(mockRes.status).toHaveBeenCalledWith(200)
      }
    })

    it('should reject ping route with invalid API token', async () => {
      mockReq.path = '/ping'
      mockReq.headers['x-api-token'] = 'invalid-token'
      
      const route = (router as any).matchRoute('GET', '/ping')
      expect(route).toBeDefined()
      
      if (route) {
        await route.handler(mockReq, mockRes)
        expect(mockRes.status).toHaveBeenCalledWith(401)
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
      }
    })
  })

  describe('Middleware Chain', () => {
    it('should apply global middleware to routes', () => {
      const router = createGenericMiddleware(mockOptions)
      const routes = router.getRoutes()
      
      // All routes should have some middleware applied
      routes.forEach(route => {
        expect(Array.isArray(route.middleware)).toBe(true)
      })
    })

    it('should include CORS middleware', () => {
      const router = createGenericMiddleware(mockOptions)
      const globalMiddleware = (router as any).getGlobalMiddleware()
      
      expect(globalMiddleware.length).toBeGreaterThan(0)
    })
  })

  describe('Configuration', () => {
    it('should handle missing optional configuration', () => {
      const minimalOptions = {
        openAIKey: 'test-key',
        adapter: mockAdapter
      }
      
      expect(() => {
        createGenericMiddleware(minimalOptions)
      }).not.toThrow()
    })

    it('should apply debug configuration', () => {
      const debugOptions = {
        ...mockOptions,
        debug: true
      }
      
      expect(() => {
        createGenericMiddleware(debugOptions)
      }).not.toThrow()
    })

    it('should handle custom session functions', () => {
      const sessionOptions = {
        ...mockOptions,
        getSession: jest.fn().mockResolvedValue('test-session'),
        validateSession: jest.fn().mockResolvedValue(true),
        sessionSecret: 'test-secret'
      }
      
      expect(() => {
        createGenericMiddleware(sessionOptions)
      }).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should throw error for invalid OpenAI key configuration', () => {
      const { setDefaultOpenAIKey } = require('@openai/agents')
      setDefaultOpenAIKey.mockImplementation(() => {
        throw new Error('Invalid API key')
      })

      expect(() => {
        createGenericMiddleware(mockOptions)
      }).toThrow('Failed to configure OpenAI agents: Invalid API key')
    })
  })

  describe('URL Processing', () => {
    it('should handle URL protocol enforcement', () => {
      const { ensureUrlProtocol } = require('./utils')
      
      const optionsWithUrl = {
        ...mockOptions,
        hubUrl: 'example.com',
        sashiServerUrl: 'localhost:3000'
      }
      
      createGenericMiddleware(optionsWithUrl)
      
      expect(ensureUrlProtocol).toHaveBeenCalledWith('example.com')
      expect(ensureUrlProtocol).toHaveBeenCalledWith('localhost:3000')
    })
  })

  describe('Route Matching', () => {
    let router: any

    beforeEach(() => {
      router = createGenericMiddleware(mockOptions)
    })

    it('should match exact routes', () => {
      const route = (router as any).matchRoute('GET', '/sanity-check')
      expect(route).toBeDefined()
      expect(route?.path).toBe('/sanity-check')
      expect(route?.method).toBe('GET')
    })

    it('should not match non-existent routes', () => {
      const route = (router as any).matchRoute('GET', '/non-existent')
      expect(route).toBeUndefined()
    })

    it('should not match wrong HTTP methods', () => {
      const route = (router as any).matchRoute('POST', '/sanity-check')
      expect(route).toBeUndefined()
    })
  })
})