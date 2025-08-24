import { initializeApp } from 'firebase-admin/app'
import { onRequest, onCall } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import { 
  createFirebaseHttpFunction, 
  createFirebaseCallableFunction,
  convertHttpToCallable 
} from '@sashimo/lib/firebase'

// Import service modules to register functions
import './services/user-service'
import './services/analytics-service'

// Initialize Firebase Admin
initializeApp()

// Set global options for all functions
setGlobalOptions({
  maxInstances: 10,
  region: 'us-central1',
  memory: '256MiB'
})

// HTTP Function for REST API access
export const sashi = onRequest({
  cors: true,
  maxInstances: 5
}, createFirebaseHttpFunction({
  openAIKey: process.env.OPENAI_API_KEY!,
  apiSecretKey: process.env.SASHI_SECRET_KEY,
  hubUrl: process.env.SASHI_HUB_URL || 'https://hub.usesashi.com',
  debug: process.env.NODE_ENV === 'development'
}))

// Callable Function for direct client calls
export const sashiCall = onCall({
  maxInstances: 5
}, createFirebaseCallableFunction({
  openAIKey: process.env.OPENAI_API_KEY!,
  apiSecretKey: process.env.SASHI_SECRET_KEY,
  hubUrl: process.env.SASHI_HUB_URL || 'https://hub.usesashi.com',
  debug: process.env.NODE_ENV === 'development'
}))

// Hybrid function - HTTP middleware converted to callable
export const sashiHybrid = onCall({
  maxInstances: 3
}, convertHttpToCallable({
  openAIKey: process.env.OPENAI_API_KEY!,
  apiSecretKey: process.env.SASHI_SECRET_KEY,
  hubUrl: process.env.SASHI_HUB_URL || 'https://hub.usesashi.com',
  debug: process.env.NODE_ENV === 'development'
}))

// Health check function
export const health = onRequest((req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    functions: {
      sashi: 'HTTP function for REST API access',
      sashiCall: 'Callable function for direct client calls',
      sashiHybrid: 'HTTP middleware converted to callable',
      health: 'This health check function'
    },
    environment: {
      node: process.version,
      region: process.env.FUNCTION_REGION || 'us-central1',
      memory: process.env.FUNCTION_MEMORY_MB || '256'
    },
    features: {
      openai: !!process.env.OPENAI_API_KEY,
      hub: !!process.env.SASHI_HUB_URL,
      debug: process.env.NODE_ENV === 'development'
    }
  })
})

// Function info endpoint
export const info = onRequest((req, res) => {
  res.json({
    name: 'Sashi Firebase Functions Example',
    version: '1.0.0',
    description: 'Firebase Functions integration with @sashimo/lib',
    endpoints: {
      '/sashi/*': 'HTTP function - REST API access',
      '/sashiCall': 'Callable function - direct client calls',
      '/sashiHybrid': 'Callable function - HTTP to callable conversion',
      '/health': 'Health check',
      '/info': 'This info endpoint'
    },
    usage: {
      http: {
        url: 'https://your-region-your-project.cloudfunctions.net/sashi/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sashi-session-token': 'your-session-token'
        },
        body: {
          type: '/chat/message',
          inquiry: 'Get all Firebase users',
          previous: []
        }
      },
      callable: {
        description: 'Call from Firebase SDK',
        example: `
          import { getFunctions, httpsCallable } from 'firebase/functions'
          
          const functions = getFunctions()
          const sashiCall = httpsCallable(functions, 'sashiCall')
          
          const result = await sashiCall({
            action: 'chat',
            inquiry: 'Get all Firebase users'
          })
        `
      }
    },
    availableFunctions: [
      'get_all_firebase_users',
      'get_firebase_user_by_id', 
      'create_firebase_user',
      'get_firebase_active_users',
      'deactivate_firebase_user',
      'track_firebase_event',
      'get_firebase_analytics_dashboard',
      'get_firebase_events_by_type',
      'get_firebase_user_events',
      'get_firebase_conversion_funnel'
    ]
  })
})