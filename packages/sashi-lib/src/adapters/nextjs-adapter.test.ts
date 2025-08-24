import { NextApiAdapter, NextAppRouterAdapter } from './nextjs-adapter'

describe('NextApiAdapter', () => {
  let adapter: NextApiAdapter

  beforeEach(() => {
    adapter = new NextApiAdapter()
  })

  describe('adaptRequest', () => {
    it('should adapt Next.js API request', () => {
      const nextReq = {
        method: 'POST',
        url: '/api/test?param=value',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer token'
        },
        body: { data: 'test' },
        query: { param: 'value', id: '123' }
      }

      const httpReq = adapter.adaptRequest(nextReq)

      expect(httpReq.method).toBe('POST')
      expect(httpReq.url).toBe('/api/test?param=value')
      expect(httpReq.path).toBe('/api/test')
      expect(httpReq.headers).toEqual(nextReq.headers)
      expect(httpReq.body).toEqual(nextReq.body)
      expect(httpReq.query).toEqual(nextReq.query)
      expect(httpReq.params).toEqual({})
      expect(httpReq.protocol).toBe('http')
      expect(httpReq.hostname).toBe('localhost')
    })

    it('should handle missing properties', () => {
      const minimalReq = {
        headers: {},
        body: null,
        query: {}
      }

      const httpReq = adapter.adaptRequest(minimalReq)

      expect(httpReq.method).toBe('GET')
      expect(httpReq.url).toBe('/')
      expect(httpReq.path).toBe('/')
    })
  })

  describe('adaptResponse', () => {
    let mockNextRes: any

    beforeEach(() => {
      mockNextRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        send: jest.fn(),
        setHeader: jest.fn(),
        getHeader: jest.fn(),
        redirect: jest.fn(),
        headersSent: false
      }
    })

    it('should adapt Next.js API response', () => {
      const httpRes = adapter.adaptResponse(mockNextRes)

      expect(typeof httpRes.status).toBe('function')
      expect(typeof httpRes.json).toBe('function')
      expect(typeof httpRes.send).toBe('function')
      expect(httpRes.headersSent).toBe(false)
    })

    it('should forward method calls', () => {
      const httpRes = adapter.adaptResponse(mockNextRes)

      httpRes.status(404)
      httpRes.json({ error: 'Not found' })
      httpRes.setHeader('Content-Type', 'application/json')

      expect(mockNextRes.status).toHaveBeenCalledWith(404)
      expect(mockNextRes.json).toHaveBeenCalledWith({ error: 'Not found' })
      expect(mockNextRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
    })

    it('should handle getHeader returning different types', () => {
      mockNextRes.getHeader
        .mockReturnValueOnce('string-value')
        .mockReturnValueOnce(123)
        .mockReturnValueOnce(['array', 'value'])
        .mockReturnValueOnce(undefined)

      const httpRes = adapter.adaptResponse(mockNextRes)

      expect(httpRes.getHeader('string')).toBe('string-value')
      expect(httpRes.getHeader('number')).toBeUndefined()
      expect(httpRes.getHeader('array')).toBeUndefined()
      expect(httpRes.getHeader('undefined')).toBeUndefined()
    })
  })

  describe('createHandler', () => {
    it('should create Next.js compatible handler', async () => {
      const mockHttpHandler = jest.fn()
      const nextHandler = adapter.createHandler(mockHttpHandler)

      const mockReq = {
        method: 'GET',
        url: '/test',
        headers: {},
        body: null,
        query: {}
      }
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        send: jest.fn(),
        setHeader: jest.fn(),
        getHeader: jest.fn(),
        redirect: jest.fn(),
        headersSent: false
      }

      await nextHandler(mockReq, mockRes)

      expect(mockHttpHandler).toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      const error = new Error('Test error')
      const mockHttpHandler = jest.fn().mockRejectedValue(error)
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const nextHandler = adapter.createHandler(mockHttpHandler)

      const mockReq = { headers: {}, body: null, query: {} }
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        getHeader: jest.fn(),
        redirect: jest.fn(),
        send: jest.fn(),
        headersSent: false
      }

      await nextHandler(mockReq, mockRes)

      expect(consoleSpy).toHaveBeenCalledWith('Next.js handler error:', error)
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' })

      consoleSpy.mockRestore()
    })
  })
})

describe('NextAppRouterAdapter', () => {
  let adapter: NextAppRouterAdapter

  beforeEach(() => {
    adapter = new NextAppRouterAdapter()
  })

  describe('adaptRequest', () => {
    it('should adapt Web API Request', () => {
      const mockHeaders = new Map([
        ['content-type', 'application/json'],
        ['authorization', 'Bearer token']
      ])

      const webReq = {
        method: 'POST',
        url: 'https://example.com/api/test?param=value&multi=1&multi=2',
        headers: {
          get: (name: string) => mockHeaders.get(name.toLowerCase()) || null,
          forEach: (callback: (value: string, key: string) => void) => {
            mockHeaders.forEach(callback)
          }
        },
        json: jest.fn(),
        text: jest.fn(),
        formData: jest.fn()
      }

      const httpReq = adapter.adaptRequest(webReq)

      expect(httpReq.method).toBe('POST')
      expect(httpReq.url).toBe('https://example.com/api/test?param=value&multi=1&multi=2')
      expect(httpReq.path).toBe('/api/test')
      expect(httpReq.protocol).toBe('https')
      expect(httpReq.hostname).toBe('example.com')
      expect(httpReq.headers['content-type']).toBe('application/json')
      expect(httpReq.headers['authorization']).toBe('Bearer token')
      expect(httpReq.query['param']).toBe('value')
      expect(httpReq.query['multi']).toEqual(['1', '2'])
    })
  })

  describe('createHandler', () => {
    it('should create App Router compatible handler', async () => {
      const mockHttpHandler = jest.fn((req, res) => {
        res.json({ message: 'success' })
      })

      const appRouterHandler = adapter.createHandler(mockHttpHandler)

      const mockHeaders = new Map()
      const webReq = {
        method: 'GET',
        url: 'https://example.com/api/test',
        headers: {
          get: (name: string) => mockHeaders.get(name.toLowerCase()) || null,
          forEach: (callback: (value: string, key: string) => void) => {
            mockHeaders.forEach(callback)
          }
        },
        json: jest.fn(),
        text: jest.fn(),
        formData: jest.fn()
      }

      const response = await appRouterHandler(webReq)

      expect(mockHttpHandler).toHaveBeenCalled()
      expect(response).toBeInstanceOf(Response)
    })

    it('should handle redirect responses', async () => {
      const mockHttpHandler = jest.fn((req, res) => {
        res.redirect('/new-url')
      })

      const appRouterHandler = adapter.createHandler(mockHttpHandler)

      const mockHeaders = new Map()
      const webReq = {
        method: 'GET',
        url: 'https://example.com/api/test',
        headers: {
          get: () => null,
          forEach: () => {}
        },
        json: jest.fn(),
        text: jest.fn(),
        formData: jest.fn()
      }

      const response = await appRouterHandler(webReq)

      expect(response).toBeInstanceOf(Response)
      // Would check response.headers.get('Location') in a real environment
    })

    it('should handle errors', async () => {
      const error = new Error('Test error')
      const mockHttpHandler = jest.fn().mockRejectedValue(error)
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const appRouterHandler = adapter.createHandler(mockHttpHandler)

      const mockHeaders = new Map()
      const webReq = {
        method: 'GET',
        url: 'https://example.com/api/test',
        headers: {
          get: () => null,
          forEach: () => {}
        },
        json: jest.fn(),
        text: jest.fn(),
        formData: jest.fn()
      }

      const response = await appRouterHandler(webReq)

      expect(consoleSpy).toHaveBeenCalledWith('Next.js App Router handler error:', error)
      expect(response).toBeInstanceOf(Response)

      consoleSpy.mockRestore()
    })
  })
})