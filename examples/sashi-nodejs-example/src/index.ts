import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { startServer, createNodeHttpHandler, createNodeHttpsServer } from '@sashimo/lib/node'

// Load environment variables
dotenv.config()

// Import service modules to register functions
import './services/system-service'
import './services/http-service'

const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = process.env.HOST || 'localhost'
const SSL_KEY_PATH = process.env.SSL_KEY_PATH
const SSL_CERT_PATH = process.env.SSL_CERT_PATH

// Check if SSL certificates are available and valid
const hasValidSSL = (): boolean => {
  if (!SSL_KEY_PATH || !SSL_CERT_PATH) {
    return false
  }
  
  try {
    return fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)
  } catch {
    return false
  }
}

async function startSashiServer() {
  console.log('🚀 Starting Sashi Node.js Server...')
  console.log('📍 Configuration:')
  console.log(`   - Host: ${HOST}`)
  console.log(`   - Port: ${PORT}`)
  console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`   - OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`)
  console.log(`   - Debug Mode: ${process.env.DEBUG === 'true' ? '✅ Enabled' : '❌ Disabled'}`)
  
  const middlewareOptions = {
    openAIKey: process.env.OPENAI_API_KEY || '',
    apiSecretKey: process.env.SASHI_SECRET_KEY,
    hubUrl: process.env.SASHI_HUB_URL || 'https://hub.usesashi.com',
    debug: process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development',
    sessionSecret: process.env.SESSION_SECRET,
    parseBody: true,
    bodyLimit: '10mb'
  }

  try {
    let server

    if (hasValidSSL()) {
      console.log('🔒 SSL certificates found, starting HTTPS server...')
      
      const httpsOptions = {
        key: fs.readFileSync(SSL_KEY_PATH!),
        cert: fs.readFileSync(SSL_CERT_PATH!)
      }
      
      server = await startServer({
        ...middlewareOptions,
        port: PORT,
        hostname: HOST,
        https: httpsOptions
      })
      
      console.log(`🔒 HTTPS server running at https://${HOST}:${PORT}`)
    } else {
      console.log('🌐 Starting HTTP server (no SSL certificates found)...')
      
      server = await startServer({
        ...middlewareOptions,
        port: PORT,
        hostname: HOST
      })
      
      console.log(`🌐 HTTP server running at http://${HOST}:${PORT}`)
    }

    // Log available endpoints
    console.log('\n📚 Available Endpoints:')
    console.log(`   - Health Check: ${hasValidSSL() ? 'https' : 'http'}://${HOST}:${PORT}/sanity-check`)
    console.log(`   - Metadata: ${hasValidSSL() ? 'https' : 'http'}://${HOST}:${PORT}/metadata`)
    console.log(`   - Sashi Bot: ${hasValidSSL() ? 'https' : 'http'}://${HOST}:${PORT}/bot`)
    console.log(`   - Chat API: ${hasValidSSL() ? 'https' : 'http'}://${HOST}:${PORT}/chat`)
    
    console.log('\n🧪 Test Commands:')
    console.log('   - "Get system info" - Node.js system information')
    console.log('   - "Get process info" - Current process details')
    console.log('   - "Get directory listing" - List files in current directory')
    console.log('   - "Ping server" - Test server responsiveness')
    console.log('   - "Make HTTP request to https://httpbin.org/json" - Test HTTP requests')
    console.log('   - "Check URL status for https://google.com" - Check URL accessibility')

    // Handle graceful shutdown
    const gracefulShutdown = (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`)
      
      server.close((err) => {
        if (err) {
          console.error('❌ Error during server shutdown:', err)
          process.exit(1)
        }
        
        console.log('✅ Server closed successfully')
        process.exit(0)
      })
    }

    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

    // Log memory usage periodically in debug mode
    if (process.env.DEBUG === 'true') {
      setInterval(() => {
        const memUsage = process.memoryUsage()
        console.log(`💾 Memory Usage: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`)
      }, 30000) // Every 30 seconds
    }

  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Alternative example: Manual server setup with custom routing
async function startCustomServer() {
  console.log('🔧 Starting custom Node.js server with manual setup...')
  
  const handler = createNodeHttpHandler({
    openAIKey: process.env.OPENAI_API_KEY || '',
    apiSecretKey: process.env.SASHI_SECRET_KEY,
    hubUrl: process.env.SASHI_HUB_URL || 'https://hub.usesashi.com',
    debug: process.env.DEBUG === 'true',
    parseBody: true
  })

  const http = require('http')
  const server = http.createServer((req: any, res: any) => {
    // Add custom headers
    res.setHeader('X-Powered-By', 'Sashi-Node.js-Example')
    res.setHeader('X-Server-Version', '1.0.0')
    
    // Add custom routing for static files or other endpoints
    if (req.url === '/favicon.ico') {
      res.statusCode = 404
      res.end()
      return
    }
    
    if (req.url === '/status') {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        status: 'running',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }))
      return
    }
    
    // Delegate to Sashi handler
    handler(req, res)
  })

  server.listen(PORT + 1, HOST, () => {
    console.log(`🔧 Custom server running at http://${HOST}:${PORT + 1}`)
    console.log(`   - Custom status endpoint: http://${HOST}:${PORT + 1}/status`)
    console.log(`   - Sashi endpoints: http://${HOST}:${PORT + 1}/*`)
  })
}

// Main execution
if (require.main === module) {
  // Check if we should start the custom server variant
  if (process.argv.includes('--custom')) {
    startCustomServer().catch(console.error)
  } else {
    startSashiServer().catch(console.error)
  }
}

export { startSashiServer, startCustomServer }