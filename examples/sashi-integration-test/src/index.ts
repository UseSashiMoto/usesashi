import { createMiddleware } from "@sashimo/lib"
import cors from "cors"
import express, { NextFunction, Request, Response } from "express"
import { Express } from "express-serve-static-core"

// Import all service modules to register functions
import "./services/analytics_service"
import "./services/content_service"
import "./services/email_service"
import "./services/file_service"
import "./services/payment_service"
import "./services/user_service"

require('dotenv').config()

const app = express()
const port = process.env.PORT || 3010

// Enhanced middleware setup
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Enhanced CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3010'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['x-sashi-session-token', 'Content-Type', 'Authorization']
}))

// Function to list all routes for debugging
const listRoutes = (app: Express) => {
    const routes: string[] = []

    const printRoutes = (pathPrefix: string, layer: any) => {
        if (layer.route) {
            const methods = Object.keys(layer.route.methods)
                .join(', ')
                .toUpperCase()
            routes.push(`${methods}: ${pathPrefix}${layer.route.path}`)
        } else if (layer.name === 'router' && layer.handle.stack) {
            layer.handle.stack.forEach((subLayer: any) =>
                printRoutes(
                    pathPrefix +
                    (layer.regexp.source !== '^\\/?$'
                        ? layer.regexp.source
                            .replace(/\\\//g, '/')
                            .replace(/(\/\^|\/\(\?)/g, '')
                        : ''),
                    subLayer
                )
            )
        }
    }

    if (app._router && app._router.stack) {
        app._router.stack.forEach((middleware: any) => {
            if (middleware.route) {
                const methods = Object.keys(middleware.route.methods)
                    .join(', ')
                    .toUpperCase()
                routes.push(`${methods}: ${middleware.route.path}`)
            } else if (middleware.name === 'router' && middleware.handle.stack) {
                middleware.handle.stack.forEach((layer: any) =>
                    printRoutes(
                        middleware.regexp.source !== '^\\/?$'
                            ? middleware.regexp.source
                                .replace(/\\\//g, '/')
                                .replace(/(\/\^|\/\(\?)/g, '')
                            : '',
                        layer
                    )
                )
            }
        })
    }

    console.log(`\\n=== Routes (${process.env.NODE_ENV || 'development'}) ===`)
    routes.forEach((route) => console.log(route))
    console.log('=====================\\n')
}


// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Sashi Integration Test Server',
        version: '1.0.0',
        status: 'healthy',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        endpoints: {
            sashi: '/sashi/bot',
            health: '/health',
            docs: '/docs'
        }
    })
})

// Enhanced health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: {
            node: process.version,
            platform: process.platform,
            env: process.env.NODE_ENV || 'development'
        },
        features: {
            openai: !!process.env.OPENAI_API_KEY,
            hub: !!process.env.HUB_URL,
            debug: process.env.DEBUG === 'true'
        }
    })
})

// API documentation endpoint
app.get('/docs', (req, res) => {
    res.json({
        title: 'Sashi Integration Test API',
        description: 'Comprehensive testing environment for all Sashi packages',
        version: '1.0.0',
        endpoints: {
            '/': 'Server info and status',
            '/health': 'Detailed health check',
            '/sashi/bot': 'Sashi AI chat interface (requires authentication)',
            '/docs': 'This documentation'
        },
        authentication: {
            method: 'Session token or Bearer token',
            header: 'x-sashi-session-token or Authorization: Bearer <token>',
            validTokens: [
                'userone-session-token (regular user)',
                'usertwo-session-token (regular user)',
                'admin-session-token (admin user)',
                'demo-session-token (demo user)'
            ]
        },
        features: [
            'User management',
            'File operations',
            'Email services',
            'Analytics and reporting',
            'Payment processing',
            'Content management',
            'Workflow automation'
        ]
    })
})

// Configure Sashi middleware with comprehensive options
app.use(
    '/sashi',
    createMiddleware({
        openAIKey: process.env.OPENAI_API_KEY || '',

        debug: process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development',
        sashiServerUrl: process.env.SASHI_SERVER_URL || `http://localhost:${port}/sashi`,
        // Additional configuration for testing
        // maxTokens: parseInt(process.env.MAX_TOKENS || '4000'),
        // temperature: parseFloat(process.env.TEMPERATURE || '0.7')
    })
)

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err.message)
    console.error('Stack:', err.stack)

    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString()
    })
})

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
    })
})

// Start server with enhanced logging
app.listen(port, () => {
    console.log(`\\n🚀 Sashi Integration Test Server`)
    console.log(`📍 Server running at http://localhost:${port}`)
    console.log(`🤖 Sashi bot available at http://localhost:${port}/sashi/bot`)
    console.log(`📊 Health check at http://localhost:${port}/health`)
    console.log(`📚 API docs at http://localhost:${port}/docs`)
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)

    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
        listRoutes(app)
    }
})

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\\n🛑 Received SIGINT, shutting down gracefully...')
    process.exit(0)
})

process.on('SIGTERM', () => {
    console.log('\\n🛑 Received SIGTERM, shutting down gracefully...')
    process.exit(0)
})

// Extend Express Request type for user info
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string
                token: string
                permissions: string[]
            }
        }
    }
}