// Example: Using @sashimo/lib with Next.js
// This file shows both API Routes and App Router usage

// ===== Option 1: Next.js API Routes (pages/api) =====
// File: pages/api/sashi/[...slug].ts

import { createNextApiHandler } from '@sashimo/lib/nextjs'

const handler = createNextApiHandler({
  openAIKey: process.env.OPENAI_API_KEY!,
  apiSecretKey: process.env.SASHI_SECRET_KEY,
  hubUrl: process.env.SASHI_HUB_URL || 'https://hub.usesashi.com',
  debug: process.env.NODE_ENV === 'development',
  
  // Optional: Custom session management
  getSession: async (req, res) => {
    // Extract session from your authentication system
    const token = req.headers.authorization?.replace('Bearer ', '')
    return token || 'anonymous'
  },
  
  validateSession: async (sessionToken, req, res) => {
    // Validate the session token
    if (sessionToken === 'anonymous') return true
    
    // Add your validation logic here
    try {
      // Example: validate JWT token
      // const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET!)
      return true
    } catch {
      return false
    }
  }
})

export default handler

// ===== Option 2: Next.js App Router (app/api) =====
// File: app/api/sashi/[...slug]/route.ts

import { createNextAppHandler } from '@sashimo/lib/nextjs'

const handlers = createNextAppHandler({
  openAIKey: process.env.OPENAI_API_KEY!,
  apiSecretKey: process.env.SASHI_SECRET_KEY,
  hubUrl: process.env.SASHI_HUB_URL || 'https://hub.usesashi.com',
  debug: process.env.NODE_ENV === 'development',
  
  // Optional: Custom session management for App Router
  getSession: async (req, res) => {
    // With App Router, you might get session from cookies or headers
    return 'app-router-session'
  }
})

// Export the HTTP methods you want to support
export const GET = handlers.GET
export const POST = handlers.POST
export const PUT = handlers.PUT
export const DELETE = handlers.DELETE

// ===== Option 3: Single Method Handler =====
// File: app/api/sashi-chat/route.ts

import { createSingleMethodHandler } from '@sashimo/lib/nextjs'

// If you only need POST for chat endpoints
export const POST = createSingleMethodHandler('POST', {
  openAIKey: process.env.OPENAI_API_KEY!,
  apiSecretKey: process.env.SASHI_SECRET_KEY,
  hubUrl: process.env.SASHI_HUB_URL || 'https://hub.usesashi.com'
})

// ===== Environment Variables =====
// Add these to your .env.local file:
/*
OPENAI_API_KEY=your_openai_api_key_here
SASHI_SECRET_KEY=your_secret_key_for_hub_communication
SASHI_HUB_URL=https://hub.usesashi.com
*/

// ===== Frontend Integration =====
// In your React components, you can now call the API:
/*
// Example React component
import { useState } from 'react'

export default function ChatComponent() {
  const [response, setResponse] = useState('')
  
  const sendMessage = async (message: string) => {
    const res = await fetch('/api/sashi/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sashi-session-token': 'your-session-token'
      },
      body: JSON.stringify({
        type: '/chat/message',
        inquiry: message,
        previous: []
      })
    })
    
    const data = await res.json()
    setResponse(data.output.content)
  }
  
  return (
    <div>
      <button onClick={() => sendMessage('Hello!')}>
        Send Message
      </button>
      <div>{response}</div>
    </div>
  )
}
*/