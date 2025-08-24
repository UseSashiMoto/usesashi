# 🔥 Sashi Firebase Functions Example

A comprehensive Firebase Functions application demonstrating how to integrate @sashimo/lib with **HTTP Functions**, **Callable Functions**, and **Hybrid Functions**.

## 🎯 What This Example Shows

- ✅ **HTTP Functions** for REST API access (`sashi`)
- ✅ **Callable Functions** for direct client SDK calls (`sashiCall`)
- ✅ **Hybrid Functions** converting HTTP to Callable (`sashiHybrid`)
- ✅ **Service Registration** with Firebase-specific functions
- ✅ **HTML Frontend** for testing both function types
- ✅ **Emulator Support** for local development
- ✅ **Production Deployment** configuration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project with Functions enabled

### 1. Firebase Setup

```bash
# Login to Firebase
firebase login

# Initialize Firebase project (if not already done)
firebase init functions

# Select your existing project or create a new one
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
# Required: OPENAI_API_KEY
```

### 4. Set Firebase Environment Variables

```bash
# Set environment variables for Firebase Functions
firebase functions:config:set openai.api_key="your_openai_api_key_here"
firebase functions:config:set sashi.secret_key="your_secret_key"
firebase functions:config:set sashi.hub_url="https://hub.usesashi.com"

# Or use .env for local development
```

### 5. Local Development with Emulator

```bash
# Start Firebase emulators
npm run serve

# Or watch for changes
npm run dev
```

### 6. Access the Application

- **Functions Emulator**: http://localhost:5001
- **Test Frontend**: Open `public/index.html` in browser
- **Emulator UI**: http://localhost:4000

### 7. Deploy to Production

```bash
npm run deploy
```

## 📁 Project Structure

```
sashi-firebase-example/
├── src/
│   ├── index.ts                  # Main functions export
│   └── services/
│       ├── user-service.ts       # User management functions
│       └── analytics-service.ts  # Analytics functions
├── public/
│   └── index.html               # Test frontend
├── lib/                         # Compiled JavaScript (auto-generated)
├── firebase.json                # Firebase configuration
├── package.json
└── README.md
```

## 🔧 Function Types

### 1. HTTP Functions

```typescript
// src/index.ts
export const sashi = onRequest(createFirebaseHttpFunction({
  openAIKey: process.env.OPENAI_API_KEY!,
  // ... configuration
}))
```

**Usage:**
```bash
curl -X POST https://us-central1-yourproject.cloudfunctions.net/sashi/chat \
  -H "Content-Type: application/json" \
  -H "x-sashi-session-token: firebase-demo-session" \
  -d '{"type": "/chat/message", "inquiry": "Get all Firebase users", "previous": []}'
```

### 2. Callable Functions

```typescript
// src/index.ts
export const sashiCall = onCall(createFirebaseCallableFunction({
  openAIKey: process.env.OPENAI_API_KEY!,
  // ... configuration
}))
```

**Usage:**
```javascript
import { getFunctions, httpsCallable } from 'firebase/functions'

const functions = getFunctions()
const sashiCall = httpsCallable(functions, 'sashiCall')

const result = await sashiCall({
  action: 'chat',
  inquiry: 'Get all Firebase users'
})
```

### 3. Hybrid Functions

```typescript
// src/index.ts
export const sashiHybrid = onCall(convertHttpToCallable({
  openAIKey: process.env.OPENAI_API_KEY!,
  // ... configuration
}))
```

**Features:**
- Converts HTTP middleware to Callable function
- Maintains full Sashi functionality
- Firebase SDK compatible

## 🧪 Available Functions

### User Management (Firebase-specific)

- `get_all_firebase_users` - Retrieve all users from Firebase backend
- `get_firebase_user_by_id` - Get specific user by Firebase ID
- `create_firebase_user` - Create new user in Firebase backend
- `get_firebase_active_users` - Get all active users from Firebase
- `deactivate_firebase_user` - Deactivate a user in Firebase

### Analytics (Firebase-specific)

- `track_firebase_event` - Track an analytics event in Firebase
- `get_firebase_analytics_dashboard` - Get Firebase Analytics dashboard metrics
- `get_firebase_events_by_type` - Get Firebase Analytics events filtered by type
- `get_firebase_user_events` - Get all events for a specific user
- `get_firebase_conversion_funnel` - Get conversion funnel data

## 🌐 Testing with Frontend

The included HTML frontend (`public/index.html`) provides:

- **Configuration**: Set Firebase project ID and region
- **Function Type Toggle**: Switch between HTTP and Callable functions
- **Test Buttons**: Pre-configured function tests
- **Custom Messages**: Send arbitrary messages
- **Response Display**: Formatted JSON responses

### Using the Frontend

1. Open `public/index.html` in your browser
2. Enter your Firebase Project ID
3. Select function type (HTTP or Callable)
4. Click test buttons or send custom messages

## 🔑 Environment Variables

### Local Development (.env)

```env
OPENAI_API_KEY=your_openai_api_key_here
SASHI_SECRET_KEY=your_secret_key_for_hub_communication
SASHI_HUB_URL=https://hub.usesashi.com
DEBUG=true
```

### Firebase Functions Config

```bash
# Set via Firebase CLI
firebase functions:config:set openai.api_key="your_key"
firebase functions:config:set sashi.secret_key="your_secret"
firebase functions:config:set sashi.hub_url="https://hub.usesashi.com"

# Access in code
process.env.OPENAI_API_KEY
process.env.SASHI_SECRET_KEY
process.env.SASHI_HUB_URL
```

## 📦 Scripts

```bash
npm run build          # Compile TypeScript
npm run build:watch    # Watch and compile
npm run serve          # Start emulator
npm run dev            # Development with watch
npm run deploy         # Deploy to production
npm run shell          # Firebase Functions shell
npm run logs           # View function logs
```

## 🚀 Deployment

### Production Deployment

```bash
# Build and deploy
npm run deploy

# Deploy specific functions
firebase deploy --only functions:sashi
firebase deploy --only functions:sashiCall
```

### Environment Variables in Production

Firebase Functions automatically loads config:

```javascript
// Automatically available
process.env.OPENAI_API_KEY    // from functions:config:set openai.api_key
process.env.SASHI_SECRET_KEY  // from functions:config:set sashi.secret_key
```

## 🔧 Configuration Options

### Firebase Functions Settings

```typescript
setGlobalOptions({
  maxInstances: 10,        // Concurrent function instances
  region: 'us-central1',   // Deployment region
  memory: '256MiB'         // Memory allocation
})
```

### Function-Specific Settings

```typescript
export const sashi = onRequest({
  cors: true,              // Enable CORS
  maxInstances: 5,         // Override global setting
  memory: '512MiB'         // More memory for this function
}, handler)
```

## 🧪 Testing

### Local Testing

```bash
# Start emulator
npm run serve

# Test HTTP function
curl -X POST http://localhost:5001/yourproject/us-central1/sashi/chat \
  -H "Content-Type: application/json" \
  -d '{"type": "/chat/message", "inquiry": "test", "previous": []}'

# Test with Firebase SDK
# Use the HTML frontend or write custom JavaScript
```

### Production Testing

```bash
# Test deployed HTTP function
curl -X POST https://us-central1-yourproject.cloudfunctions.net/sashi/chat \
  -H "Content-Type: application/json" \
  -H "x-sashi-session-token: firebase-demo-session" \
  -d '{"type": "/chat/message", "inquiry": "Get all Firebase users", "previous": []}'
```

## 🔍 Monitoring

### View Logs

```bash
# All function logs
firebase functions:log

# Specific function logs
firebase functions:log --only sashi

# Follow logs in real-time
firebase functions:log --only sashi --lines 50
```

### Firebase Console

- **Functions**: https://console.firebase.google.com/project/yourproject/functions
- **Logs**: https://console.firebase.google.com/project/yourproject/functions/logs
- **Usage**: https://console.firebase.google.com/project/yourproject/functions/usage

## 🐛 Troubleshooting

### Common Issues

1. **Environment Variables Not Set**
   ```
   Error: OpenAI API key not provided
   ```
   **Solution:** Set config with `firebase functions:config:set`

2. **CORS Errors in Browser**
   ```
   Access to fetch blocked by CORS policy
   ```
   **Solution:** Ensure `cors: true` in function options

3. **Function Not Found**
   ```
   Function not found: sashi
   ```
   **Solution:** Check deployment and function export names

4. **Emulator Issues**
   ```
   Error: Could not load functions source code
   ```
   **Solution:** Run `npm run build` before `npm run serve`

### Debug Mode

Enable debug logging:

```typescript
createFirebaseHttpFunction({
  debug: true,
  // ... other options
})
```

## 🔄 Comparison: HTTP vs Callable vs Hybrid

| Feature | HTTP Functions | Callable Functions | Hybrid Functions |
|---------|----------------|-------------------|------------------|
| **Client Type** | Any HTTP client | Firebase SDK only | Firebase SDK only |
| **Authentication** | Manual headers | Automatic context | Automatic context |
| **CORS** | Manual setup | Not needed | Not needed |
| **Error Handling** | HTTP status codes | Firebase exceptions | Firebase exceptions |
| **Performance** | Direct HTTP | SDK overhead | SDK + conversion |
| **Security** | Manual validation | Built-in validation | Built-in validation |

## 🎯 Best Practices

### Security

```typescript
// Validate authentication context
export const secureFunction = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated')
  }
  
  // Function implementation
})
```

### Error Handling

```typescript
// Proper error handling for Callable functions
try {
  const result = await sashiCall({ action: 'chat', inquiry: 'test' })
} catch (error) {
  if (error.code === 'unauthenticated') {
    // Handle auth error
  } else {
    // Handle other errors
  }
}
```

### Performance

```typescript
// Set appropriate memory and timeout
export const heavyFunction = onRequest({
  memory: '1GiB',
  timeoutSeconds: 540,
  maxInstances: 3
}, handler)
```

## 📚 Learn More

- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Firebase SDK Documentation](https://firebase.google.com/docs/reference/js)
- [Cloud Functions v2](https://firebase.google.com/docs/functions/2nd-gen)
- [Sashi Documentation](https://docs.usesashi.com)

## 🤝 Contributing

This example demonstrates Firebase Functions integration patterns. When adding features:

1. Update all three function types (HTTP, Callable, Hybrid)
2. Add corresponding frontend tests
3. Update this README with new functionality
4. Test with both emulator and production

---

**Built with ❤️ for the Sashi ecosystem**