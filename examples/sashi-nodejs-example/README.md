# ⚙️ Sashi Node.js Native Server Example

A comprehensive **native Node.js HTTP server** application demonstrating how to integrate @sashimo/lib without any web frameworks. This example showcases pure Node.js HTTP server capabilities with Sashi integration.

## 🎯 What This Example Shows

- ✅ **Native Node.js HTTP Server** using built-in `http` and `https` modules
- ✅ **Framework-Free Implementation** - no Express, Fastify, or other frameworks
- ✅ **HTTPS Support** with SSL certificate auto-detection
- ✅ **System-Level Functions** (system info, process details, file operations)
- ✅ **HTTP Client Functions** (make requests, check URLs, request logging)
- ✅ **Interactive Frontend** for testing all functionality
- ✅ **Graceful Shutdown** and error handling
- ✅ **Memory Monitoring** and performance tracking

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (native ES modules and modern features)
- No additional frameworks or dependencies required!

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
# Required: OPENAI_API_KEY
```

### 3. Start Development Server

```bash
# Development with auto-reload
npm run dev

# Or build and start production server
npm run build
npm start
```

### 4. Access the Application

- **Server**: http://localhost:3000
- **Health Check**: http://localhost:3000/sanity-check
- **Metadata**: http://localhost:3000/metadata
- **Sashi Bot UI**: http://localhost:3000/bot
- **Test Frontend**: Open `public/index.html` in your browser

### 5. Optional: HTTPS Setup

```bash
# Add SSL certificate paths to .env
SSL_KEY_PATH=/path/to/your/ssl/key.pem
SSL_CERT_PATH=/path/to/your/ssl/cert.pem

# Server will automatically detect and use HTTPS
npm start
```

## 📁 Project Structure

```
sashi-nodejs-example/
├── src/
│   ├── index.ts                 # Main server implementation
│   └── services/
│       ├── system-service.ts    # System information functions
│       └── http-service.ts      # HTTP client functions
├── public/
│   └── index.html              # Interactive test frontend
├── dist/                       # Compiled JavaScript (auto-generated)
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Server Implementation

### Simple Server (Recommended)

```typescript
import { startServer } from '@sashimo/lib/node'

const server = await startServer({
  openAIKey: process.env.OPENAI_API_KEY!,
  port: 3000,
  hostname: 'localhost',
  debug: true
})
```

### Custom Server with Manual Setup

```typescript
import { createNodeHttpHandler } from '@sashimo/lib/node'
import * as http from 'http'

const handler = createNodeHttpHandler({
  openAIKey: process.env.OPENAI_API_KEY!,
  parseBody: true
})

const server = http.createServer((req, res) => {
  // Add custom headers or routing here
  res.setHeader('X-Powered-By', 'Sashi-Node.js')
  
  // Delegate to Sashi handler
  handler(req, res)
})

server.listen(3000)
```

### HTTPS Server

```typescript
import { createNodeHttpsServer } from '@sashimo/lib/node'
import * as fs from 'fs'

const server = createNodeHttpsServer({
  openAIKey: process.env.OPENAI_API_KEY!,
  // ... other options
}, {
  key: fs.readFileSync('path/to/key.pem'),
  cert: fs.readFileSync('path/to/cert.pem')
})

server.listen(443)
```

## 🧪 Available Functions

### System Functions

- `get_system_info` - Comprehensive Node.js system information
- `get_process_info` - Current process details and memory usage  
- `get_directory_listing` - File system operations and directory listing
- `get_environment_variables` - Filtered environment variables (secure)
- `ping_server` - Server responsiveness test with custom messages

### HTTP Client Functions

- `make_http_request` - Make HTTP GET requests to external URLs
- `check_url_status` - Check URL accessibility and response headers
- `get_request_log` - View history of HTTP requests made by server
- `clear_request_log` - Clear the request log

## 🔑 Environment Variables

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional
SASHI_SECRET_KEY=your_secret_key
SASHI_HUB_URL=https://hub.usesashi.com
PORT=3000
HOST=localhost
DEBUG=true
SESSION_SECRET=your_session_secret

# HTTPS (optional)
SSL_KEY_PATH=path/to/ssl/key.pem
SSL_CERT_PATH=path/to/ssl/cert.pem
```

## 🧪 Testing with Frontend

The included HTML frontend (`public/index.html`) provides:

- **Server Configuration**: Set server URL and session token
- **System Function Tests**: All system information functions
- **HTTP Function Tests**: External request and URL checking
- **Custom Messages**: Send arbitrary messages to test functions
- **Real-time Responses**: Formatted JSON response display
- **Server Health Check**: Verify server connectivity

### Example Commands

```bash
# System information
"Get system info"
"Get process info"
"Get directory listing"
"Get environment variables"

# HTTP operations  
"Make HTTP request to https://httpbin.org/json"
"Check URL status for https://github.com"
"Get request log"

# Custom operations
"Get directory listing for /tmp"
"Ping server with message Hello World"
"Check URL status for https://api.github.com"
```

## 📦 Scripts

```bash
npm run dev           # Development with nodemon auto-reload
npm run build         # Compile TypeScript to JavaScript
npm start             # Start compiled production server
npm run serve         # Alias for start
npm run type-check    # TypeScript type checking only
npm run clean         # Remove compiled files
```

## 🚀 Deployment

### Production Deployment

```bash
# Build for production
npm run build

# Start production server
NODE_ENV=production npm start

# Or use PM2 for process management
pm2 start dist/index.js --name sashi-nodejs
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables in Production

```bash
# Set production environment variables
export OPENAI_API_KEY="your_production_key"
export NODE_ENV="production"
export PORT="3000"
export HOST="0.0.0.0"

# For HTTPS in production
export SSL_KEY_PATH="/etc/ssl/private/key.pem"
export SSL_CERT_PATH="/etc/ssl/certs/cert.pem"
```

## 🔧 Advanced Configuration

### Custom Request Parsing

```typescript
const handler = createNodeHttpHandler({
  openAIKey: process.env.OPENAI_API_KEY!,
  parseBody: true,        // Enable automatic body parsing
  bodyLimit: '10mb',      // Set body size limit
  sessionSecret: 'secret' // Enable session token validation
})
```

### Custom Routing Integration

```typescript
const sashiHandler = createNodeHttpHandler(options)

const server = http.createServer((req, res) => {
  // Custom routes
  if (req.url === '/custom') {
    res.end('Custom response')
    return
  }
  
  // Static file serving
  if (req.url?.startsWith('/static/')) {
    // Handle static files
    return
  }
  
  // Delegate to Sashi
  sashiHandler(req, res)
})
```

### Memory Monitoring

```typescript
// Built-in memory monitoring in debug mode
if (process.env.DEBUG === 'true') {
  setInterval(() => {
    const usage = process.memoryUsage()
    console.log(`Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`)
  }, 30000)
}
```

## 🔍 Monitoring and Debugging

### Server Logs

The server provides detailed logging:

```bash
🚀 Starting Sashi Node.js Server...
📍 Configuration:
   - Host: localhost
   - Port: 3000
   - Environment: development
   - OpenAI API Key: ✅ Set
   - Debug Mode: ✅ Enabled

🌐 HTTP server running at http://localhost:3000

📚 Available Endpoints:
   - Health Check: http://localhost:3000/sanity-check
   - Metadata: http://localhost:3000/metadata
   - Sashi Bot: http://localhost:3000/bot
   - Chat API: http://localhost:3000/chat
```

### Memory Usage Monitoring

```bash
💾 Memory Usage: RSS=45MB, Heap=23MB
```

### Health Check Endpoint

```bash
curl http://localhost:3000/sanity-check
```

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```
   Error: EADDRINUSE: address already in use :::3000
   ```
   **Solution:** Change PORT in .env or kill existing process

2. **OpenAI API Key Missing**
   ```
   Error: OpenAI API key not provided
   ```
   **Solution:** Add OPENAI_API_KEY to .env file

3. **SSL Certificate Issues**
   ```
   Error: ENOENT: no such file or directory, open 'key.pem'
   ```
   **Solution:** Check SSL_KEY_PATH and SSL_CERT_PATH or remove them for HTTP

4. **Memory Issues**
   ```
   JavaScript heap out of memory
   ```
   **Solution:** Increase Node.js memory limit: `node --max-old-space-size=4096`

### Debug Mode

Enable verbose logging:

```env
DEBUG=true
NODE_ENV=development
```

### Server Variants

```bash
# Start default server
npm start

# Start custom server with additional routing
npm start -- --custom
```

## 🎯 Performance Considerations

### Memory Management

- Automatic request log rotation (keeps last 100 entries)
- Memory usage monitoring in debug mode
- Graceful shutdown handling
- Process memory reporting

### HTTP Performance

- Built-in request timeout handling
- Efficient body parsing
- Minimal memory footprint
- No framework overhead

### Security Features

- Environment variable filtering (sensitive data excluded)
- Session token validation support
- HTTPS support with certificate auto-detection
- Request timeout protection

## 🔄 Comparison with Framework Examples

| Feature | Native Node.js | Express.js | Next.js | Firebase |
|---------|---------------|------------|---------|----------|
| **Memory Usage** | Minimal | Moderate | Higher | Managed |
| **Startup Time** | Fastest | Fast | Moderate | Cold start |
| **Flexibility** | Maximum | High | Framework-bound | Platform-bound |
| **Complexity** | Simple | Simple | Moderate | Moderate |
| **Dependencies** | Minimal | Some | Many | Managed |

## 🎖️ Best Practices

### Error Handling

```typescript
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
  process.exit(1)
})
```

### Graceful Shutdown

```typescript
const gracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`)
  server.close(() => process.exit(0))
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
```

### Security Headers

```typescript
res.setHeader('X-Content-Type-Options', 'nosniff')
res.setHeader('X-Frame-Options', 'DENY')
res.setHeader('X-XSS-Protection', '1; mode=block')
```

## 📚 Learn More

- [Node.js HTTP Module Documentation](https://nodejs.org/api/http.html)
- [Node.js HTTPS Module Documentation](https://nodejs.org/api/https.html)
- [Node.js Process Documentation](https://nodejs.org/api/process.html)
- [Sashi Documentation](https://docs.usesashi.com)

## 🤝 Contributing

This example demonstrates pure Node.js integration without frameworks. When contributing:

1. Keep dependencies minimal - avoid adding frameworks
2. Maintain compatibility with Node.js 18+
3. Update both HTTP and HTTPS implementations
4. Test memory usage and performance impact
5. Update the interactive frontend for new functions

---

**Built with ❤️ for the Sashi ecosystem - Pure Node.js Power!**