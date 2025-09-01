# Sashi Security Guide: UI-to-Middleware Authentication

This guide explains how to implement secure authentication between the Sashi UI frontend and middleware backend.

## Current Security Architecture

Sashi uses a multi-layered security approach:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Sashi Hub     │◄──►│  Your Middleware │◄──►│   Sashi UI      │
│                 │    │                 │    │                 │
│ Authentication: │    │ Authentication: │    │ Authentication: │
│ • API Secret    │    │ • API Secret    │    │ • Session Token │
│   Key           │    │   (Hub ↔ MW)    │    │   (UI ↔ MW)     │
│                 │    │ • Session Token │    │                 │
│                 │    │   (UI ↔ MW)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Security Layers

### 1. Hub ↔ Middleware (System-level)

- **Purpose**: Secure communication between Sashi Hub and your middleware
- **Method**: API Secret Key via `x-api-token` header
- **Use Case**: Remote workflow execution, function registry sync

### 2. UI ↔ Middleware (User-level)

- **Purpose**: Secure user sessions between frontend and backend
- **Method**: Session tokens via `x-sashi-session-token` header
- **Use Case**: Chat interactions, workflow execution, user-specific data

## Implementation Options

### Option 1: JWT-based Sessions (Recommended)

JWT tokens provide stateless, secure session management with built-in expiration.

```typescript
import { createMiddleware } from "@sashimo/lib"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.SESSION_SECRET || "your-secret-key-here"

const createJWTSession = async (
    req: Request,
    res: Response
): Promise<string> => {
    const userId = req.user?.id || "anonymous"

    return jwt.sign({ userId, timestamp: Date.now() }, JWT_SECRET, {
        expiresIn: "24h",
    })
}

const validateJWTSession = async (
    sessionToken: string,
    req: Request,
    res: Response
): Promise<boolean> => {
    try {
        const decoded = jwt.verify(sessionToken, JWT_SECRET)
        req.user = decoded // Store user info for request handlers
        return true
    } catch (error) {
        return false
    }
}

app.use(
    "/sashi",
    createMiddleware({
        openAIKey: process.env.OPENAI_API_KEY!,
        sessionSecret: JWT_SECRET,
        getSession: createJWTSession,
        validateSession: validateJWTSession,
    })
)
```

### Option 2: Database-backed Sessions

For more control over session lifecycle and revocation:

```typescript
class SessionManager {
    async createSession(userId: string): Promise<string> {
        const sessionId = crypto.randomUUID()
        await db.sessions.create({
            id: sessionId,
            userId,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        })
        return sessionId
    }

    async validateSession(
        sessionId: string
    ): Promise<{ valid: boolean; userId?: string }> {
        const session = await db.sessions.findOne({
            where: {
                id: sessionId,
                expiresAt: { $gt: new Date() },
            },
        })

        return session
            ? { valid: true, userId: session.userId }
            : { valid: false }
    }
}
```

### Option 3: Integration with Existing Auth Systems

If you have an existing authentication system:

```typescript
const validateExistingAuth = async (
    sessionToken: string,
    req: Request,
    res: Response
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
        // ... other options
        validateSession: validateExistingAuth,
    })
)
```

## Security Best Practices

### 1. Environment Variables

```bash
# .env
SESSION_SECRET=your-very-long-random-secret-key-here
API_SECRET_KEY=your-hub-api-secret-key
OPENAI_API_KEY=your-openai-key
```

### 2. HTTPS Only

```typescript
if (process.env.NODE_ENV === "production") {
    app.use((req, res, next) => {
        if (!req.secure) {
            return res.redirect(301, `https://${req.get("host")}${req.url}`)
        }
        next()
    })
}
```

### 3. Rate Limiting

```typescript
import rateLimit from "express-rate-limit"

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
})

app.use("/sashi", limiter)
```

### 4. CORS Configuration

```typescript
app.use(
    "/sashi",
    cors({
        origin: ["https://yourdomain.com", "https://app.yourdomain.com"],
        credentials: true,
    })
)
```

### 5. Content Security Policy

```typescript
app.use("/sashi", (req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline'"
    )
    next()
})
```

## UI-side Configuration

Ensure your UI sends the session token with every request:

```typescript
// In your Sashi UI configuration
import axios from "axios"

// Set up axios interceptor to include session token
axios.interceptors.request.use((config) => {
    const sessionToken = getSessionToken() // Your session retrieval logic
    if (sessionToken) {
        config.headers["x-sashi-session-token"] = sessionToken
    }
    return config
})
```

## Session Management Workflow

1. **User Authentication**: User logs into your app
2. **Session Creation**: Your auth system creates a session
3. **Sashi Session**: When accessing Sashi, create a Sashi-specific session token
4. **Token Validation**: Every Sashi request validates the session token
5. **Session Renewal**: Implement token refresh for long-lived sessions
6. **Session Cleanup**: Remove expired/invalid sessions

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Session token missing or invalid
    - Check if token is being sent in headers
    - Verify token hasn't expired
    - Ensure validation function is working correctly

2. **CORS Errors**: Cross-origin request blocked
    - Configure CORS properly in middleware
    - Ensure origin is allowlisted

3. **Session Not Persisting**: Token not being stored/retrieved
    - Check UI session storage implementation
    - Verify axios interceptors are configured

### Debug Mode

Enable debug mode to see session validation details:

```typescript
app.use(
    "/sashi",
    createMiddleware({
        // ... other options
        debug: true, // Enable detailed logging
    })
)
```

## Migration Guide

If you're upgrading from basic session tokens to secure sessions:

1. Update your middleware configuration to include `validateSession`
2. Implement proper session token generation
3. Update UI to handle new token format
4. Test authentication flow thoroughly
5. Deploy with proper environment variables

## Security Checklist

- [ ] Use HTTPS in production
- [ ] Implement proper session validation
- [ ] Set up rate limiting
- [ ] Configure CORS appropriately
- [ ] Use environment variables for secrets
- [ ] Implement session expiration
- [ ] Add request logging for security monitoring
- [ ] Test authentication edge cases
- [ ] Set up session cleanup processes
- [ ] Document your authentication flow

For more advanced security requirements, consider implementing:

- Multi-factor authentication
- IP whitelisting
- Request signing
- Audit logging
- Session revocation endpoints
