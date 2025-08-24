# @sashimo/lib Framework Usage Guide

The `@sashimo/lib` package now supports multiple web frameworks through a generic HTTP abstraction layer. This allows you to use Sashi with Express.js, Next.js, Firebase Functions, or any Node.js HTTP server.

## Architecture

The library uses an adapter pattern:
- **Generic Core**: Framework-agnostic middleware that handles all Sashi functionality
- **Adapters**: Convert framework-specific request/response objects to generic HTTP interfaces
- **Entry Points**: Framework-specific functions that wire everything together

## Framework Support

### Express.js (Recommended for existing users)

```typescript
import { createExpressMiddleware } from '@sashimo/lib/express'

const sashiMiddleware = createExpressMiddleware({
  openAIKey: 'your-openai-key',
  apiSecretKey: 'your-secret',
  hubUrl: 'https://hub.usesashi.com'
})

app.use('/sashi', sashiMiddleware)
```

For backward compatibility, the original import still works:
```typescript
import { createMiddleware } from '@sashimo/lib'
// This is now an alias for createExpressMiddleware
```

### Next.js API Routes (pages/api)

```typescript
// pages/api/sashi/[...slug].ts
import { createNextApiHandler } from '@sashimo/lib/nextjs'

const handler = createNextApiHandler({
  openAIKey: process.env.OPENAI_API_KEY!,
  apiSecretKey: process.env.SASHI_SECRET_KEY,
  hubUrl: process.env.SASHI_HUB_URL
})

export default handler
```

### Next.js App Router (app/api)

```typescript
// app/api/sashi/[...slug]/route.ts
import { createNextAppHandler } from '@sashimo/lib/nextjs'

const handlers = createNextAppHandler({
  openAIKey: process.env.OPENAI_API_KEY!,
  apiSecretKey: process.env.SASHI_SECRET_KEY,
  hubUrl: process.env.SASHI_HUB_URL
})

export const GET = handlers.GET
export const POST = handlers.POST
export const PUT = handlers.PUT
export const DELETE = handlers.DELETE
```

### Firebase Functions

#### HTTP Functions
```typescript
import { createFirebaseHttpFunction } from '@sashimo/lib/firebase'
import { onRequest } from 'firebase-functions/v2/https'

const sashiHandler = createFirebaseHttpFunction({
  openAIKey: process.env.OPENAI_API_KEY!,
  apiSecretKey: process.env.SASHI_SECRET_KEY,
  hubUrl: process.env.SASHI_HUB_URL
})

export const sashi = onRequest(sashiHandler)
```

#### Callable Functions
```typescript
import { createFirebaseCallableFunction } from '@sashimo/lib/firebase'
import { onCall } from 'firebase-functions/v2/https'

const sashiCallable = createFirebaseCallableFunction({
  openAIKey: process.env.OPENAI_API_KEY!,
  apiSecretKey: process.env.SASHI_SECRET_KEY,
  hubUrl: process.env.SASHI_HUB_URL
})

export const sashiCall = onCall(sashiCallable)
```

### Node.js HTTP Server

```typescript
import { createNodeHttpServer, startServer } from '@sashimo/lib/node'

// Option 1: Create a complete server
const server = await startServer({
  openAIKey: process.env.OPENAI_API_KEY!,
  apiSecretKey: process.env.SASHI_SECRET_KEY,
  hubUrl: process.env.SASHI_HUB_URL,
  port: 3000
})

// Option 2: Create just the handler
import { createNodeHttpHandler } from '@sashimo/lib/node'
import http from 'http'

const handler = createNodeHttpHandler({
  openAIKey: process.env.OPENAI_API_KEY!,
  apiSecretKey: process.env.SASHI_SECRET_KEY,
  hubUrl: process.env.SASHI_HUB_URL
})

const server = http.createServer(handler)
server.listen(3000)
```

## Configuration Options

All framework entry points accept the same configuration options:

```typescript
interface MiddlewareOptions {
  // Required
  openAIKey: string

  // Optional
  debug?: boolean
  repos?: string[]
  sashiServerUrl?: string
  apiSecretKey?: string
  hubUrl?: string
  langFuseInfo?: {
    publicKey: string
    secretKey: string
    baseUrl: string
  }
  getSession?: (req: HttpRequest, res: HttpResponse) => Promise<string>
  validateSession?: (sessionToken: string, req: HttpRequest, res: HttpResponse) => Promise<boolean>
  sessionSecret?: string
}
```

## Custom Integrations

If you need to integrate with a framework not listed above, you can use the generic HTTP abstractions:

```typescript
import { createGenericMiddleware, HttpAdapter } from '@sashimo/lib'

// Create your own adapter
class CustomAdapter implements HttpAdapter {
  adaptRequest(originalRequest: any): HttpRequest {
    // Convert your framework's request to HttpRequest
  }
  
  adaptResponse(originalResponse: any): HttpResponse {
    // Convert your framework's response to HttpResponse
  }
  
  createHandler(httpHandler: HttpHandler) {
    // Return a handler compatible with your framework
  }
}

const genericRouter = createGenericMiddleware({
  openAIKey: 'your-key',
  adapter: new CustomAdapter()
})
```

## Migration Guide

### From Express-only to Multi-framework

If you're currently using the Express-only version:

**Before:**
```typescript
import { createMiddleware } from '@sashimo/lib'
```

**After (no change needed):**
```typescript
import { createMiddleware } from '@sashimo/lib'
// Still works! Now an alias for createExpressMiddleware
```

**Or use the explicit import:**
```typescript
import { createExpressMiddleware } from '@sashimo/lib/express'
```

### Package.json Dependencies

The core package no longer includes framework-specific dependencies as `dependencies`. This means:

- **Express users**: No change needed - Express is still in `peerDependencies`
- **Next.js users**: No additional dependencies required
- **Firebase users**: No additional dependencies required  
- **Node.js users**: No additional dependencies required

## Testing

Each adapter includes comprehensive tests that don't require the actual framework dependencies, making the package lighter and more compatible.

## Troubleshooting

### "Cannot resolve module" errors
Make sure you're importing from the correct entry point:
- Express: `@sashimo/lib` or `@sashimo/lib/express`
- Next.js: `@sashimo/lib/nextjs`
- Firebase: `@sashimo/lib/firebase`
- Node.js: `@sashimo/lib/node`

### Type errors
The generic HTTP types are designed to be compatible with all frameworks. If you encounter type issues, you can cast to `any` at the framework boundary:

```typescript
const handler = createNextApiHandler(options)
export default handler as any // Cast to Next.js handler type if needed
```

### Runtime errors
All adapters include error handling and logging. Check your console for detailed error messages.