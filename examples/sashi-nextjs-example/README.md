# 🚀 Sashi Next.js Example

A comprehensive Next.js application demonstrating how to integrate @sashimo/lib with both **API Routes** (Pages Router) and **App Router** implementations.

## 🎯 What This Example Shows

- ✅ **API Routes Integration** (`pages/api/sashi/[...slug].ts`)
- ✅ **App Router Integration** (`app/api/sashi-app/[[...slug]]/route.ts`)  
- ✅ **Frontend Implementation** with React components
- ✅ **Session Management** for both routing approaches
- ✅ **Service Registration** with user and content management
- ✅ **Error Handling** and loading states

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. Environment Setup

```bash
# Copy example environment file
cp .env.example .env.local

# Edit .env.local with your configuration
# Required: OPENAI_API_KEY
```

### 3. Start Development Server

```bash
npm run dev
# or
yarn dev
```

### 4. Access the Application

- **Pages Router Demo**: http://localhost:3000
- **App Router Demo**: http://localhost:3000/app  
- **API Routes Sashi Bot**: http://localhost:3000/api/sashi/bot
- **App Router Sashi Bot**: http://localhost:3000/api/sashi-app/bot

## 📁 Project Structure

```
sashi-nextjs-example/
├── pages/
│   ├── api/sashi/
│   │   └── [...slug].ts          # API Routes implementation
│   └── index.tsx                 # Pages Router demo page
├── app/
│   ├── api/sashi-app/
│   │   └── [[...slug]]/route.ts  # App Router implementation  
│   ├── layout.tsx                # App Router layout
│   └── page.tsx                  # App Router demo page
├── services/
│   ├── user-service.ts           # User management functions
│   └── content-service.ts        # Content management functions
└── README.md
```

## 🔧 Implementation Details

### API Routes (Pages Router)

```typescript
// pages/api/sashi/[...slug].ts
import { createNextApiHandler } from '@sashimo/lib/nextjs'

const handler = createNextApiHandler({
  openAIKey: process.env.OPENAI_API_KEY!,
  // ... configuration
})

export default handler
```

**Features:**
- Traditional Next.js API routes
- File-based routing with `[...slug]` catch-all
- Compatible with Next.js 12+
- Supports all HTTP methods

### App Router (New)

```typescript
// app/api/sashi-app/[[...slug]]/route.ts
import { createNextAppHandler } from '@sashimo/lib/nextjs'

const handlers = createNextAppHandler({
  openAIKey: process.env.OPENAI_API_KEY!,
  // ... configuration
})

export const GET = handlers.GET
export const POST = handlers.POST
// ... other methods
```

**Features:**
- Modern App Router with `app/` directory
- Explicit HTTP method exports
- Server Components support
- Requires Next.js 13+

## 🔑 Environment Variables

Create `.env.local` file:

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional
SASHI_SECRET_KEY=your_secret_key_for_hub_communication  
SASHI_HUB_URL=https://hub.usesashi.com
NEXT_PUBLIC_API_URL=http://localhost:3000
DEBUG=true
```

## 🧪 Testing the Integration

### Available AI Functions

The example includes these registered functions:

**User Management:**
- `get_all_users` - Retrieve all users
- `get_user_by_id` - Get specific user  
- `create_user` - Create new user
- `get_active_users` - Get only active users

**Content Management:**
- `get_all_content` - Retrieve all content
- `get_content_by_type` - Filter by content type
- `create_content` - Create new content
- `search_content` - Search content by query

### Test Commands

Try these in the demo interfaces:

```
"Get all users"
"Show me active users only"  
"Create a user named John with email john@test.com"
"Get all content items"
"Search for content about Next.js"
"Create a blog post titled 'My First Post' about React by 'Jane Doe'"
```

### API Testing with curl

```bash
# Test API Routes
curl -X POST http://localhost:3000/api/sashi/chat \
  -H "Content-Type: application/json" \
  -H "x-sashi-session-token: nextjs-demo-session" \
  -d '{"type": "/chat/message", "inquiry": "Get all users", "previous": []}'

# Test App Router  
curl -X POST http://localhost:3000/api/sashi-app/chat \
  -H "Content-Type: application/json" \
  -H "x-sashi-session-token: app-router-demo-session" \
  -d '{"type": "/chat/message", "inquiry": "Get all users", "previous": []}'
```

## 🔒 Authentication

Both implementations include demo session management:

**Valid Session Tokens:**
- `nextjs-demo-session` (API Routes)
- `app-router-demo-session` (App Router)
- `user-session-token` (Both)
- `admin-session-token` (Both)

**Headers:**
- `x-sashi-session-token: <token>`
- `Authorization: Bearer <token>`

## 🎨 Frontend Components

### Pages Router Component

Located in `pages/index.tsx`:
- Radio buttons to switch between API types
- Test function buttons
- Custom message input
- Response display area

### App Router Component  

Located in `app/page.tsx`:
- Client Component with `'use client'` directive
- App Router specific styling
- Integration with App Router API endpoints

## 🔄 Comparison: Pages vs App Router

| Feature | Pages Router | App Router |
|---------|-------------|------------|
| **File Location** | `pages/api/` | `app/api/` |
| **Routing** | `[...slug].ts` | `[[...slug]]/route.ts` |
| **Export Style** | `export default handler` | `export const GET = ...` |
| **Next.js Version** | 12+ | 13+ |
| **Performance** | Traditional | Optimized |
| **Caching** | Manual | Built-in |

## 📦 Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production  
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables:
   - `OPENAI_API_KEY`
   - `SASHI_SECRET_KEY` (optional)
   - `SASHI_HUB_URL` (optional)

### Other Platforms

This example works on any platform that supports Next.js:
- Netlify
- Railway  
- DigitalOcean App Platform
- AWS Amplify

## 🔧 Customization

### Adding New Services

1. Create a new file in `services/` directory:

```typescript
// services/my-service.ts
import { registerFunction } from "@sashimo/lib"

registerFunction({
  name: "my_function",
  description: "My custom function",
  parameters: {
    // ... parameter schema
  },
  handler: async (params) => {
    // ... implementation
  }
})
```

2. Import in your API route:

```typescript
import '../../../services/my-service'
```

### Custom Session Management

```typescript
const handler = createNextApiHandler({
  // ... other config
  getSession: async (req, res) => {
    // Extract from your auth system
    return req.cookies.sessionId || 'anonymous'
  },
  validateSession: async (sessionToken, req, res) => {
    // Validate against your user database
    return await isValidSession(sessionToken)
  }
})
```

## 🐛 Troubleshooting

### Common Issues

1. **Module Not Found Errors**
   ```
   Error: Cannot resolve '@sashimo/lib/nextjs'
   ```
   **Solution:** Ensure @sashimo/lib is properly installed and built

2. **API Route Not Found**  
   ```
   404 - This page could not be found
   ```
   **Solution:** Check file naming and location of API routes

3. **OpenAI API Key Missing**
   ```
   Error: OpenAI API key not provided
   ```
   **Solution:** Add OPENAI_API_KEY to .env.local

4. **Session Validation Fails**
   ```
   401 - Unauthorized
   ```
   **Solution:** Check session token headers and validation logic

### Debug Mode

Enable debug logging:

```env
DEBUG=true
NODE_ENV=development
```

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [App Router Guide](https://nextjs.org/docs/app)  
- [API Routes Guide](https://nextjs.org/docs/api-routes/introduction)
- [Sashi Documentation](https://docs.usesashi.com)

## 🤝 Contributing

This example demonstrates best practices for Next.js integration. When adding new features:

1. Update both API Routes and App Router implementations
2. Add corresponding frontend demos
3. Update this README with new functionality
4. Test on both Next.js 12+ and 13+

---

**Built with ❤️ for the Sashi ecosystem**