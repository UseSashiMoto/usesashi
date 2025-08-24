import { GenericRouter } from './generic-router'
import { HttpRequest, HttpResponse, MiddlewareHandler } from '../types/http'

describe('GenericRouter', () => {
  let router: GenericRouter
  let mockReq: HttpRequest
  let mockRes: HttpResponse
  let mockHandler: jest.MockedFunction<MiddlewareHandler>

  beforeEach(() => {
    router = new GenericRouter()
    mockReq = {
      method: 'GET',
      url: '/test',
      path: '/test',
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
    mockHandler = jest.fn()
  })

  describe('Route Registration', () => {
    it('should register GET routes', () => {
      router.get('/test', mockHandler)
      const routes = router.getRoutes()
      
      expect(routes).toHaveLength(1)
      expect(routes[0]?.method).toBe('GET')
      expect(routes[0]?.path).toBe('/test')
      expect(routes[0]?.handler).toBe(mockHandler)
    })

    it('should register POST routes', () => {
      router.post('/test', mockHandler)
      const routes = router.getRoutes()
      
      expect(routes).toHaveLength(1)
      expect(routes[0]?.method).toBe('POST')
    })

    it('should register PUT routes', () => {
      router.put('/test', mockHandler)
      const routes = router.getRoutes()
      
      expect(routes).toHaveLength(1)
      expect(routes[0]?.method).toBe('PUT')
    })

    it('should register DELETE routes', () => {
      router.delete('/test', mockHandler)
      const routes = router.getRoutes()
      
      expect(routes).toHaveLength(1)
      expect(routes[0]?.method).toBe('DELETE')
    })

    it('should register PATCH routes', () => {
      router.patch('/test', mockHandler)
      const routes = router.getRoutes()
      
      expect(routes).toHaveLength(1)
      expect(routes[0]?.method).toBe('PATCH')
    })

    it('should register OPTIONS routes', () => {
      router.options('/test', mockHandler)
      const routes = router.getRoutes()
      
      expect(routes).toHaveLength(1)
      expect(routes[0]?.method).toBe('OPTIONS')
    })

    it('should throw error when no handlers provided', () => {
      expect(() => {
        router.get('/test')
      }).toThrow('No handlers provided for GET /test')
    })
  })

  describe('Middleware Registration', () => {
    it('should register global middleware', () => {
      const middleware1 = jest.fn()
      const middleware2 = jest.fn()
      
      router.use(middleware1)
      router.use(middleware2)
      
      const globalMiddleware = router.getGlobalMiddleware()
      expect(globalMiddleware).toEqual([middleware1, middleware2])
    })

    it('should register path-specific middleware', () => {
      const middleware = jest.fn()
      
      router.use('/api', middleware)
      
      const routes = router.getRoutes()
      expect(routes).toHaveLength(1)
      expect(routes[0]?.path).toBe('/api')
      expect(routes[0]?.handler).toBe(middleware)
    })

    it('should include middleware in route handlers', () => {
      const middleware = jest.fn()
      const handler = jest.fn()
      
      router.use(middleware) // Global middleware
      router.get('/test', handler)
      
      const routes = router.getRoutes()
      expect(routes[0]?.middleware).toContain(middleware)
    })

    it('should include route-specific middleware', () => {
      const middleware1 = jest.fn()
      const middleware2 = jest.fn()
      const handler = jest.fn()
      
      router.get('/test', middleware1, middleware2, handler)
      
      const routes = router.getRoutes()
      expect(routes[0]?.middleware).toEqual([middleware1, middleware2])
      expect(routes[0]?.handler).toBe(handler)
    })
  })

  describe('Route Matching', () => {
    beforeEach(() => {
      router.get('/exact', mockHandler)
      router.get('/users/:id', mockHandler)
      router.post('/users', mockHandler)
    })

    it('should match exact paths', () => {
      const route = router.matchRoute('GET', '/exact')
      expect(route).toBeDefined()
      expect(route?.path).toBe('/exact')
      expect(route?.method).toBe('GET')
    })

    it('should match parameterized paths', () => {
      const route = router.matchRoute('GET', '/users/123')
      expect(route).toBeDefined()
      expect(route?.path).toBe('/users/:id')
    })

    it('should match correct HTTP method', () => {
      const getRoute = router.matchRoute('GET', '/users/123')
      const postRoute = router.matchRoute('POST', '/users')
      
      expect(getRoute?.method).toBe('GET')
      expect(postRoute?.method).toBe('POST')
    })

    it('should return undefined for non-matching routes', () => {
      const route = router.matchRoute('GET', '/nonexistent')
      expect(route).toBeUndefined()
    })

    it('should not match wrong HTTP method', () => {
      const route = router.matchRoute('PUT', '/exact')
      expect(route).toBeUndefined()
    })
  })

  describe('Parameter Extraction', () => {
    it('should extract single parameter', () => {
      const params = router.extractParams('/users/:id', '/users/123')
      expect(params).toEqual({ id: '123' })
    })

    it('should extract multiple parameters', () => {
      const params = router.extractParams('/users/:userId/posts/:postId', '/users/123/posts/456')
      expect(params).toEqual({ userId: '123', postId: '456' })
    })

    it('should return empty object for routes without parameters', () => {
      const params = router.extractParams('/exact', '/exact')
      expect(params).toEqual({})
    })

    it('should handle missing parameter values', () => {
      const params = router.extractParams('/users/:id', '/users/')
      expect(params).toEqual({ id: '' })
    })
  })

  describe('Path Matching Logic', () => {
    let router: GenericRouter

    beforeEach(() => {
      router = new GenericRouter()
    })

    it('should match middleware routes that start with the path', () => {
      router.use('/api', mockHandler)
      
      const route1 = router.matchRoute('GET', '/api/users')
      const route2 = router.matchRoute('POST', '/api/posts')
      
      expect(route1).toBeDefined()
      expect(route2).toBeDefined()
    })

    it('should not match root middleware for unrelated paths', () => {
      router.use('/api', mockHandler)
      
      const route = router.matchRoute('GET', '/other')
      expect(route).toBeUndefined()
    })
  })
})