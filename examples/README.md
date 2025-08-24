# 🚀 Sashi Framework Examples

This directory contains comprehensive examples demonstrating how to integrate `@sashimo/lib` with different web frameworks and server technologies.

## 📁 Available Examples

### 🚀 [sashi-express-example](./sashi-express-example/)
**Express.js Integration**
- Traditional Express.js server with comprehensive middleware
- Real-world service examples (users, analytics, content, email, payments, files)
- Advanced features: CORS, body parsing, error handling
- Interactive Sashi bot UI and comprehensive test endpoints
- **Status**: ✅ **Fully Working** - Tested and operational

### ⚡ [sashi-nextjs-example](./sashi-nextjs-example/)
**Next.js Integration (Both API Routes & App Router)**
- **API Routes**: Traditional `pages/api` directory approach
- **App Router**: Modern `app/api` directory with explicit HTTP method exports
- Interactive frontend components for testing both approaches
- TypeScript implementation with full type safety
- **Status**: ✅ **Ready for Testing** - Complete implementation

### 🔥 [sashi-firebase-example](./sashi-firebase-example/)
**Firebase Functions Integration**
- **HTTP Functions**: REST API endpoints for external access
- **Callable Functions**: Direct Firebase SDK integration
- **Hybrid Functions**: HTTP-to-Callable conversion examples
- Emulator support for local development
- Production deployment configuration
- **Status**: ✅ **Ready for Testing** - Complete implementation

### ⚙️ [sashi-nodejs-example](./sashi-nodejs-example/)
**Native Node.js HTTP Server**
- Pure Node.js implementation without any web frameworks
- System-level functions (process info, file operations, HTTP requests)
- HTTPS support with automatic SSL certificate detection
- Interactive HTML frontend for testing
- Memory monitoring and graceful shutdown
- **Status**: ✅ **Ready for Testing** - Complete implementation

## 🎯 Framework Comparison

| Feature | Express.js | Next.js | Firebase | Node.js |
|---------|------------|---------|----------|---------|
| **Framework** | Express.js | Next.js 13+ | Firebase Functions | Native Node.js |
| **Setup Complexity** | Simple | Moderate | Moderate | Minimal |
| **Dependencies** | Moderate | Many | Managed | Minimal |
| **Performance** | High | High | Auto-scaling | Highest |
| **Deployment** | Manual | Multiple options | Automatic | Manual |
| **Learning Curve** | Easy | Moderate | Moderate | Advanced |
| **Best For** | Web APIs | Full-stack apps | Serverless | Microservices |

## 🚀 Quick Start Guide

### 1. Choose Your Framework

Pick the example that matches your technology stack:

```bash
# Express.js (traditional web servers)
cd sashi-express-example

# Next.js (React-based full-stack)
cd sashi-nextjs-example

# Firebase Functions (serverless)
cd sashi-firebase-example

# Native Node.js (maximum control)
cd sashi-nodejs-example
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

```bash
cp .env.example .env
# Edit .env with your OPENAI_API_KEY
```

### 4. Start Development

```bash
# Most examples
npm run dev

# Firebase (with emulator)
npm run serve
```

## 🔧 Common Configuration

All examples support these environment variables:

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional
SASHI_SECRET_KEY=your_secret_key
SASHI_HUB_URL=https://hub.usesashi.com
DEBUG=true
```

## 🧪 Testing Examples

Each example includes:

- ✅ **Health Check Endpoints** - Verify server status
- ✅ **Interactive Frontend** - Test functions via web UI  
- ✅ **Sample Functions** - Pre-registered AI functions
- ✅ **API Documentation** - Built-in endpoint documentation
- ✅ **Error Handling** - Comprehensive error responses

### Common Test Commands

Try these in any example's Sashi bot interface:

```
"Get all users"
"Create a user named Test User with email test@example.com"  
"Get system information"
"Process a payment for user_123"
"Send an email to user@example.com"
"Get analytics dashboard"
```

## 📚 Architecture Overview

### Shared Foundation

All examples use the new **framework-agnostic core** from `@sashimo/lib`:

```
@sashimo/lib
├── Generic HTTP Abstractions
├── Adapter Pattern for Framework Integration  
├── Universal AI Function System
├── Session Management (Optional)
└── Error Handling & Debugging
```

### Framework-Specific Adapters

Each example includes:

- **Request/Response Adaptation** - Convert framework objects to generic format
- **Route Handling** - Map framework routing to Sashi endpoints
- **Error Handling** - Framework-appropriate error responses  
- **Authentication** - Framework-specific session management

## 🔄 Migration Between Frameworks

The examples are designed to be **migration-friendly**:

1. **Service Functions** - Copy `services/` directory between examples
2. **Configuration** - Similar environment variable setup
3. **Frontend Integration** - Adapt API calls to new endpoints
4. **Business Logic** - AI functions work identically across frameworks

### Migration Example: Express → Next.js

```bash
# Copy service functions
cp -r sashi-express-example/src/services/* sashi-nextjs-example/services/

# Update imports in Next.js API routes
# Change: import './services/user-service'
# No other changes needed!
```

## 🛠️ Development Workflow

### 1. Start with Express Example
- **Easiest to understand** and debug
- **Complete feature set** with all services
- **Fastest setup** for testing concepts

### 2. Extend to Your Framework
- **Copy service functions** from Express example
- **Adapt the API integration** to your framework
- **Test with the same commands** to ensure compatibility

### 3. Production Deployment
- **Express**: Traditional hosting (PM2, Docker, etc.)
- **Next.js**: Vercel, Netlify, or custom deployment
- **Firebase**: Automatic serverless scaling
- **Node.js**: Docker containers, cloud instances

## 🔍 Debugging & Troubleshooting

### Common Issues

1. **OpenAI API Key Missing**
   ```
   Error: OpenAI API key not provided
   ```
   **Solution**: Add `OPENAI_API_KEY` to `.env` file

2. **Port Already in Use**
   ```
   Error: EADDRINUSE: address already in use
   ```
   **Solution**: Change `PORT` in `.env` or kill existing process

3. **Framework-Specific Dependencies**
   ```
   Error: Cannot resolve module
   ```
   **Solution**: Run `npm install` in the example directory

### Debug Mode

Enable verbose logging in any example:

```env
DEBUG=true
NODE_ENV=development
```

## 🤝 Contributing

When adding new examples or features:

1. **Follow the Pattern** - Use the same structure across examples
2. **Update Documentation** - Keep READMEs current
3. **Test All Frameworks** - Ensure consistency
4. **Add Service Examples** - Include real-world function examples

## 📝 Example Status

| Example | Build | Runtime | Frontend | Documentation |
|---------|-------|---------|----------|---------------|
| Express | ✅ | ✅ | ✅ | ✅ |
| Next.js | ✅ | ⏳ | ✅ | ✅ |
| Firebase | ✅ | ⏳ | ✅ | ✅ |
| Node.js | ✅ | ⏳ | ✅ | ✅ |

**Legend:**
- ✅ Tested and working
- ⏳ Ready for testing  
- ❌ Known issues

---

**Choose the example that fits your stack and start building with Sashi! 🚀**