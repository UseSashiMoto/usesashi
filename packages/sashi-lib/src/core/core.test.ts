/**
 * Tests for Sashi Core Web Standards implementation
 */

import { createSashiCore } from './core'
import { SashiCoreOptions } from './types'

// Mock external dependencies
jest.mock('../ai-function-loader', () => ({
  getFunctionRegistry: () => new Map(),
  getFunctionAttributes: () => new Map(),
  toggleFunctionActive: jest.fn()
}))

jest.mock('@openai/agents', () => ({
  setDefaultOpenAIKey: jest.fn()
}))

jest.mock('../aibot', () => ({
  createAIBot: jest.fn()
}))

describe('Sashi Core', () => {
  let core: any
  const mockOptions: SashiCoreOptions = {
    openAIKey: 'test-key',
    debug: true,
    apiSecretKey: 'test-secret',
    hubUrl: 'https://test-hub.com'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    core = createSashiCore(mockOptions)
  })

  describe('Core Creation', () => {
    it('should create a core instance', () => {
      expect(core).toBeDefined()
      expect(typeof core.handleRequest).toBe('function')
      expect(typeof core.addRoute).toBe('function')
      expect(typeof core.addMiddleware).toBe('function')
    })

    it('should register built-in routes', () => {
      const routes = core.getRoutes()
      expect(routes.length).toBeGreaterThan(0)
      
      const routePaths = routes.map((route: any) => route.path)
      expect(routePaths).toContain('/sanity-check')
      expect(routePaths).toContain('/ping')
      expect(routePaths).toContain('/metadata')
    })
  })

  describe('Request Handling', () => {
    it('should handle sanity check request', async () => {
      const request = new Request('http://localhost/sanity-check', {
        method: 'GET'
      })

      const response = await core.handleRequest(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.message).toBe('Sashi Middleware is running')
      expect(data.timestamp).toBeDefined()
    })

    it('should handle ping request with valid token', async () => {
      const request = new Request('http://localhost/ping', {
        method: 'GET',
        headers: {
          'x-api-token': 'test-secret'
        }
      })

      const response = await core.handleRequest(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.message).toBe('Sashi Middleware is running')
      expect(data.token).toBe('test-secret')
    })

    it('should reject ping request with invalid token', async () => {
      const request = new Request('http://localhost/ping', {
        method: 'GET',
        headers: {
          'x-api-token': 'wrong-token'
        }
      })

      const response = await core.handleRequest(request)
      expect(response.status).toBe(401)
      
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle metadata request', async () => {
      const request = new Request('http://localhost/metadata', {
        method: 'GET'
      })

      const response = await core.handleRequest(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.hubUrl).toBe('https://test-hub.com')
      expect(Array.isArray(data.functions)).toBe(true)
    })

    it('should return 404 for unknown routes', async () => {
      const request = new Request('http://localhost/unknown-route', {
        method: 'GET'
      })

      const response = await core.handleRequest(request)
      expect(response.status).toBe(404)
      
      const data = await response.json()
      expect(data.error).toBe('Not found')
    })

    it('should handle CORS preflight requests', async () => {
      const request = new Request('http://localhost/sanity-check', {
        method: 'OPTIONS'
      })

      const response = await core.handleRequest(request)
      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    })
  })

  describe('Route Registration', () => {
    it('should allow adding custom routes', () => {
      const customHandler = async () => new Response('custom')
      
      core.addRoute({
        method: 'GET',
        path: '/custom',
        handler: customHandler
      })

      const routes = core.getRoutes()
      const customRoute = routes.find((route: any) => route.path === '/custom')
      expect(customRoute).toBeDefined()
      expect(customRoute.handler).toBe(customHandler)
    })

    it('should support parameterized routes', async () => {
      const paramHandler = async (request: any) => {
        return new Response(JSON.stringify({
          id: request.sashiContext.params.id
        }))
      }
      
      core.addRoute({
        method: 'GET',
        path: '/users/:id',
        handler: paramHandler
      })

      const request = new Request('http://localhost/users/123', {
        method: 'GET'
      })

      const response = await core.handleRequest(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.id).toBe('123')
    })
  })

  describe('Context Handling', () => {
    it('should extract query parameters', async () => {
      const queryHandler = async (request: any) => {
        return new Response(JSON.stringify(request.sashiContext.query))
      }
      
      core.addRoute({
        method: 'GET',
        path: '/query-test',
        handler: queryHandler
      })

      const request = new Request('http://localhost/query-test?foo=bar&baz=qux', {
        method: 'GET'
      })

      const response = await core.handleRequest(request)
      const data = await response.json()
      expect(data.foo).toBe('bar')
      expect(data.baz).toBe('qux')
    })

    it('should handle context metadata', async () => {
      const request = new Request('http://localhost/sanity-check', {
        method: 'GET'
      })

      const context = { sessionId: 'test-session', userId: 'test-user' }
      const response = await core.handleRequest(request, context)
      
      expect(response.status).toBe(200)
    })
  })
})
