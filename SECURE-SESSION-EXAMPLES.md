# Secure Session Authentication Examples

This document provides practical examples of how to implement secure authentication between Sashi UI and middleware.

## Option 1: JWT-based Session Management (Recommended)

JWT tokens provide stateless, secure session management with built-in expiration.

```typescript
import { createMiddleware } from "@usesashi/sashi-lib"
import express from "express"
import jwt from "jsonwebtoken"

// 1. JWT-based Session Management (Recommended)
const JWT_SECRET = process.env.SESSION_SECRET || "your-secret-key-here"
const SESSION_EXPIRY = "24h"

// Custom session creation function
const createJWTSession = async (
    req: express.Request,
    res: express.Response
): Promise<string> => {
    // Extract user information from your authentication system
    const userId = req.user?.id || "anonymous"
    const userRole = req.user?.role || "user"

    // Create JWT token with user context
    const token = jwt.sign(
        {
            userId,
            userRole,
            timestamp: Date.now(),
        },
        JWT_SECRET,
        { expiresIn: SESSION_EXPIRY }
    )

    return token
}

// Custom session validation function
const validateJWTSession = async (
    sessionToken: string,
    req: express.Request,
    res: express.Response
): Promise<boolean> => {
    try {
        const decoded = jwt.verify(sessionToken, JWT_SECRET) as any

        // Optional: Add additional validation logic
        // - Check if user still exists in database
        // - Check if user has required permissions
        // - Check if session hasn't been revoked

        // Store user info in request for use in handlers
        req.user = {
            id: decoded.userId,
            role: decoded.userRole,
        }

        return true
    } catch (error) {
        console.error("JWT validation failed:", error)
        return false
    }
}

// 2. Setup middleware with secure session authentication
const app = express()

// Your authentication middleware (runs before Sashi)
app.use("/sashi", async (req, res, next) => {
    // Your app's authentication logic here
    // Set req.user based on your auth system

    // Example: Extract from Authorization header, cookies, etc.
    const authHeader = req.headers.authorization
    if (authHeader) {
        // Validate your app's auth token and set req.user
        req.user = { id: "user123", role: "admin" } // Example
    }

    next()
})

// Sashi middleware with secure session management
app.use(
    "/sashi",
    createMiddleware({
        openAIKey: process.env.OPENAI_API_KEY!,
        sessionSecret: JWT_SECRET, // Used for secure token signing
        getSession: createJWTSession, // Custom session creation
        validateSession: validateJWTSession, // Custom session validation
        debug: true,
    })
)
```

## Option 2: Database-backed Session Management

For more control over session lifecycle and revocation:

```typescript
interface SessionData {
    userId: string
    createdAt: Date
    lastAccessed: Date
    data: Record<string, any>
}

class DatabaseSessionManager {
    private sessions = new Map<string, SessionData>() // Use real database in production

    async createSession(
        userId: string,
        data: Record<string, any> = {}
    ): Promise<string> {
        const sessionId = crypto.randomUUID()
        const sessionData: SessionData = {
            userId,
            createdAt: new Date(),
            lastAccessed: new Date(),
            data,
        }

        this.sessions.set(sessionId, sessionData)
        return sessionId
    }

    async validateSession(
        sessionId: string
    ): Promise<{ valid: boolean; userId?: string }> {
        const session = this.sessions.get(sessionId)

        if (!session) {
            return { valid: false }
        }

        // Check if session is expired (24 hours)
        const now = new Date()
        const hoursSinceCreated =
            (now.getTime() - session.createdAt.getTime()) / (1000 * 60 * 60)

        if (hoursSinceCreated > 24) {
            this.sessions.delete(sessionId)
            return { valid: false }
        }

        // Update last accessed
        session.lastAccessed = now

        return { valid: true, userId: session.userId }
    }

    async destroySession(sessionId: string): Promise<void> {
        this.sessions.delete(sessionId)
    }
}

// Usage with database session manager
const sessionManager = new DatabaseSessionManager()

const createDatabaseSession = async (
    req: express.Request,
    res: express.Response
): Promise<string> => {
    const userId = req.user?.id || "anonymous"
    return await sessionManager.createSession(userId, {
        userAgent: req.headers["user-agent"],
    })
}

const validateDatabaseSession = async (
    sessionToken: string,
    req: express.Request,
    res: express.Response
): Promise<boolean> => {
    const result = await sessionManager.validateSession(sessionToken)

    if (result.valid && result.userId) {
        // You might want to load full user data here
        req.user = { id: result.userId }
        return true
    }

    return false
}

// Setup with database session manager
app.use(
    "/sashi",
    createMiddleware({
        openAIKey: process.env.OPENAI_API_KEY!,
        getSession: createDatabaseSession,
        validateSession: validateDatabaseSession,
        debug: true,
    })
)
```

## Option 3: Integration with Existing Auth Systems

If you have an existing authentication system:

```typescript
const validateExistingAuth = async (
    sessionToken: string,
    req: express.Request,
    res: express.Response
): Promise<boolean> => {
    // Validate against your existing session store
    const user = await yourAuthSystem.validateSession(sessionToken)

    if (user) {
        req.user = user
        return true
    }

    return false
}

app.use(
    "/sashi",
    createMiddleware({
        openAIKey: process.env.OPENAI_API_KEY!,
        validateSession: validateExistingAuth,
        debug: true,
    })
)
```

## Security Best Practices

### HTTPS Only in Production

```typescript
if (process.env.NODE_ENV === "production") {
    app.use((req, res, next) => {
        if (!req.secure && req.get("x-forwarded-proto") !== "https") {
            return res.redirect(301, `https://${req.get("host")}${req.url}`)
        }
        next()
    })
}
```

### Rate Limiting

```typescript
import rateLimit from "express-rate-limit"

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP",
})

app.use("/sashi", limiter)
```

### CORS with Specific Origins

```typescript
app.use("/sashi", (req, res, next) => {
    const allowedOrigins = [
        "https://yourdomain.com",
        "https://app.yourdomain.com",
    ]

    const origin = req.headers.origin
    if (allowedOrigins.includes(origin || "")) {
        res.header("Access-Control-Allow-Origin", origin)
    }

    next()
})
```

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Required for all middleware
OPENAI_API_KEY=sk-...
API_SECRET_KEY=your-api-secret-for-hub-communication

# Required for JWT sessions
SESSION_SECRET=your-very-long-random-secret-key-here

# Optional
NODE_ENV=production
```

## Implementation Notes

- **JWT sessions** are stateless and don't require database storage
- **Database sessions** provide more control but require storage management
- **Session expiration** should be configured based on your security requirements
- **Rate limiting** helps prevent abuse and DoS attacks
- **CORS configuration** should be restricted to your actual domains in production

Choose the option that best fits your existing authentication architecture and security requirements.
