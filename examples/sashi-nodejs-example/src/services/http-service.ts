import { registerFunction } from "@sashimo/lib"
import * as http from 'http'
import * as https from 'https'
import * as url from 'url'

// Simple HTTP request data store for demonstration
const requestLog: Array<{
  id: string
  url: string
  method: string
  status: number
  responseTime: number
  timestamp: string
}> = []

registerFunction({
  name: "make_http_request",
  description: "Make an HTTP GET request to a specified URL",
  parameters: {
    type: "object",
    properties: {
      targetUrl: {
        type: "string",
        description: "The URL to make a request to"
      },
      timeout: {
        type: "number",
        description: "Request timeout in milliseconds",
        default: 5000
      }
    },
    required: ["targetUrl"]
  },
  handler: async ({ targetUrl, timeout = 5000 }: { targetUrl: string, timeout?: number }) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      const parsedUrl = url.parse(targetUrl)
      const isHttps = parsedUrl.protocol === 'https:'
      const httpModule = isHttps ? https : http
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path,
        method: 'GET',
        timeout: timeout,
        headers: {
          'User-Agent': 'Sashi-Node.js-Example/1.0.0'
        }
      }
      
      const req = httpModule.request(options, (res) => {
        let data = ''
        
        res.on('data', (chunk) => {
          data += chunk
        })
        
        res.on('end', () => {
          const responseTime = Date.now() - startTime
          const logEntry = {
            id: `req_${Date.now()}`,
            url: targetUrl,
            method: 'GET',
            status: res.statusCode || 0,
            responseTime,
            timestamp: new Date().toISOString()
          }
          requestLog.push(logEntry)
          
          // Keep only last 100 requests
          if (requestLog.length > 100) {
            requestLog.shift()
          }
          
          resolve({
            url: targetUrl,
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            responseTime: responseTime,
            bodyLength: data.length,
            body: data.length > 1000 ? data.substring(0, 1000) + '...' : data,
            source: "Node.js Native Server"
          })
        })
      })
      
      req.on('error', (error) => {
        reject(new Error(`HTTP request failed: ${error.message}`))
      })
      
      req.on('timeout', () => {
        req.destroy()
        reject(new Error(`Request timeout after ${timeout}ms`))
      })
      
      req.end()
    })
  }
})

registerFunction({
  name: "get_request_log",
  description: "Get the log of recent HTTP requests made by the server",
  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Maximum number of log entries to return",
        default: 10
      }
    }
  },
  handler: async ({ limit = 10 }: { limit?: number }) => {
    const recentRequests = requestLog
      .slice(-limit)
      .reverse()
    
    return {
      requests: recentRequests,
      count: recentRequests.length,
      totalRequests: requestLog.length,
      source: "Node.js Native Server"
    }
  }
})

registerFunction({
  name: "clear_request_log",
  description: "Clear the HTTP request log",
  parameters: {},
  handler: async () => {
    const clearedCount = requestLog.length
    requestLog.length = 0
    
    return {
      message: "Request log cleared successfully",
      clearedEntries: clearedCount,
      source: "Node.js Native Server"
    }
  }
})

registerFunction({
  name: "check_url_status",
  description: "Check if a URL is accessible and return basic information",
  parameters: {
    type: "object",
    properties: {
      targetUrl: {
        type: "string",
        description: "The URL to check"
      }
    },
    required: ["targetUrl"]
  },
  handler: async ({ targetUrl }: { targetUrl: string }) => {
    try {
      const result = await new Promise<any>((resolve, reject) => {
        const startTime = Date.now()
        const parsedUrl = url.parse(targetUrl)
        const isHttps = parsedUrl.protocol === 'https:'
        const httpModule = isHttps ? https : http
        
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.path,
          method: 'HEAD', // Use HEAD for just checking status
          timeout: 5000,
          headers: {
            'User-Agent': 'Sashi-Node.js-Example/1.0.0'
          }
        }
        
        const req = httpModule.request(options, (res) => {
          const responseTime = Date.now() - startTime
          
          resolve({
            url: targetUrl,
            accessible: true,
            status: res.statusCode,
            statusText: res.statusMessage,
            responseTime: responseTime,
            headers: {
              'content-type': res.headers['content-type'],
              'content-length': res.headers['content-length'],
              'server': res.headers['server'],
              'last-modified': res.headers['last-modified']
            }
          })
        })
        
        req.on('error', (error) => {
          resolve({
            url: targetUrl,
            accessible: false,
            error: error.message,
            responseTime: Date.now() - startTime
          })
        })
        
        req.on('timeout', () => {
          req.destroy()
          resolve({
            url: targetUrl,
            accessible: false,
            error: 'Request timeout',
            responseTime: Date.now() - startTime
          })
        })
        
        req.end()
      })
      
      return {
        ...result,
        timestamp: new Date().toISOString(),
        source: "Node.js Native Server"
      }
    } catch (error) {
      return {
        url: targetUrl,
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        source: "Node.js Native Server"
      }
    }
  }
})