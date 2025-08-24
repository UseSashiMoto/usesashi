# 🚀 Sashi Next.js Example

A clean Next.js example demonstrating how to integrate @sashimo/lib using the modern **App Router** approach.

## 🎯 What This Example Shows

- ✅ **App Router Integration** (`app/api/sashi-app/[[...slug]]/route.ts`)
- ✅ **Modern Next.js 14+ Features** with TypeScript
- ✅ **Frontend Implementation** with React Server/Client Components
- ✅ **Session Management** and authentication
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

- **Demo Interface**: http://localhost:3000
- **Sashi Bot UI**: http://localhost:3000/api/sashi-app/bot
- **API Endpoints**: http://localhost:3000/api/sashi-app/\*

## 📁 Project Structure

```
sashi-nextjs-example/
├── app/
│   ├── api/sashi-app/
│   │   └── [[...slug]]/route.ts  # App Router API implementation
│   ├── layout.tsx                # App layout component
│   └── page.tsx                  # Main demo page
├── services/
│   ├── user-service.ts           # User management functions
│   └── content-service.ts        # Content management functions
└── README.md
```

## 🔧 Implementation Details

### App Router Integration

```typescript
// app/api/sashi-app/[[...slug]]/route.ts
import { createNextAppHandler } from "@sashimo/lib/nextjs"

const handlers = createNextAppHandler({
    openAIKey: process.env.OPENAI_API_KEY!,
    // ... configuration
})

export const GET = handlers.GET
export const POST = handlers.POST
// ... other methods
```

**Features:**

- ✅ Modern App Router with `app/` directory structure
- ✅ Explicit HTTP method exports (GET, POST, etc.)
- ✅ Server and Client Components support
- ✅ Built-in caching and performance optimizations
- ✅ Requires Next.js 13+ (tested with 14+)

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
# Test the chat endpoint
curl -X POST http://localhost:3000/api/sashi-app/chat \
  -H "Content-Type: application/json" \
  -H "x-sashi-session-token: nextjs-demo-session" \
  -d '{"type": "/chat/message", "inquiry": "Get all users", "previous": []}'

# Test function listing
curl -X GET http://localhost:3000/api/sashi-app/functions \
  -H "x-sashi-session-token: nextjs-demo-session"
```

## 🔒 Authentication

The example includes demo session management:

**Valid Session Tokens:**

- `nextjs-demo-session` (primary demo token)
- `user-session-token`
- `admin-session-token`

**Headers:**

- `x-sashi-session-token: <token>`
- `Authorization: Bearer <token>`

## 🎨 Frontend Component

The demo interface (`app/page.tsx`) includes:

- ✅ **Client Component** with `'use client'` directive for interactivity
- ✅ **Test function buttons** for quick AI function testing
- ✅ **Custom message input** for natural language queries
- ✅ **Real-time response display** with formatted output
- ✅ **Loading states** and error handling
- ✅ **Modern styling** with responsive grid layout

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
import { registerFunctionIntoAI } from "@sashimo/lib"

registerFunctionIntoAI({
    name: "my_function",
    description: "My custom function",
    parameters: {
        // ... parameter schema
    },
    handler: async (params) => {
        // ... implementation
    },
})
```

2. Import in your API route:

```typescript
import "../../../services/my-service"
```

### Custom Session Management

```typescript
// app/api/sashi-app/[[...slug]]/route.ts
const handlers = createNextAppHandler({
    // ... other config
    getSession: async (req, res) => {
        // Extract from your auth system
        const cookies = req.headers.get("cookie")
        return parseCookies(cookies).sessionId || "anonymous"
    },
    validateSession: async (sessionToken, req, res) => {
        // Validate against your user database
        return await isValidSession(sessionToken)
    },
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

    **Solution:** Ensure the file is located at `app/api/sashi-app/[[...slug]]/route.ts`

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

This example demonstrates best practices for Next.js App Router integration. When adding new features:

1. Follow App Router conventions and patterns
2. Add corresponding frontend demos and test cases
3. Update this README with new functionality
4. Ensure compatibility with Next.js 13+ and 14+
5. Test with both development and production builds

---

**Built with ❤️ for the Sashi ecosystem**
