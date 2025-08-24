'use client'

import { useState } from 'react'

export default function Home() {
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async (message: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/sashi-app/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sashi-session-token': 'nextjs-demo-session'
        },
        body: JSON.stringify({
          type: '/chat/message',
          inquiry: message,
          previous: []
        })
      })
      
      const data = await res.json()
      
      if (res.ok) {
        setResponse(data.output?.content || JSON.stringify(data, null, 2))
      } else {
        setResponse(`Error: ${data.error || 'Unknown error occurred'}`)
      }
    } catch (error) {
      setResponse(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    setLoading(false)
  }

  const testFunctions = [
    { name: 'Get All Users', message: 'Get all users in the system' },
    { name: 'Get Active Users', message: 'Show me only active users' },
    { name: 'Get All Content', message: 'Get all content items' },
    { name: 'Search Content', message: 'Search for content about "Next.js"' },
    { name: 'Create User', message: 'Create a new user named "Test User" with email test@example.com' },
    { name: 'Create Content', message: 'Create a new blog post titled "Test Article" about Next.js by "Test Author"' },
  ]

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🚀 Sashi Next.js Example</h1>
      <p>This example demonstrates how to integrate Sashi with Next.js using the App Router.</p>
      
      <div style={{ marginBottom: '2rem', padding: '1rem', background: '#e8f4f8', borderRadius: '8px' }}>
        <h3>🎯 Features</h3>
        <ul>
          <li>✅ Next.js 14+ App Router</li>
          <li>✅ TypeScript support</li>
          <li>✅ AI-powered chat interface</li>
          <li>✅ User and content management</li>
          <li>✅ RESTful API endpoints via <code>/api/sashi-app/*</code></li>
        </ul>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>🧪 Test Functions</h2>
        <p style={{ color: '#666', marginBottom: '1rem' }}>
          Click any button below to test the AI-powered functions, or type your own message.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {testFunctions.map((func, index) => (
            <button
              key={index}
              onClick={() => sendMessage(func.message)}
              disabled={loading}
              style={{
                padding: '1rem',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: loading ? '#f9f9f9' : '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.2s ease',
                fontSize: '0.9rem',
                fontWeight: '500'
              }}
            >
              {func.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>💬 Custom Message</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Ask anything about users or content..."
            style={{ 
              flex: 1, 
              padding: '0.75rem', 
              fontSize: '1rem',
              border: '1px solid #ddd',
              borderRadius: '6px',
              outline: 'none'
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                sendMessage((e.target as HTMLInputElement).value)
                ;(e.target as HTMLInputElement).value = ''
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.querySelector('input[type="text"]') as HTMLInputElement
              if (input.value.trim()) {
                sendMessage(input.value)
                input.value = ''
              }
            }}
            disabled={loading}
            style={{ 
              padding: '0.75rem 1.5rem', 
              fontSize: '1rem',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>📋 Response</h2>
        <pre style={{
          background: '#f8f9fa',
          border: '1px solid #e9ecef',
          padding: '1rem',
          borderRadius: '8px',
          overflow: 'auto',
          maxHeight: '400px',
          whiteSpace: 'pre-wrap',
          fontSize: '0.9rem',
          lineHeight: '1.5'
        }}>
          {response || 'No response yet. Click a button or send a message above to get started.'}
        </pre>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f0f8ff', borderRadius: '8px', borderLeft: '4px solid #0070f3' }}>
        <h3>📚 Quick Start Guide</h3>
        <ol>
          <li><strong>Try the test buttons</strong> - Each button sends a different AI query</li>
          <li><strong>Use natural language</strong> - Ask questions like "Show me all users" or "Create a user"</li>
          <li><strong>Check the API</strong> - Visit <code>/api/sashi-app/bot</code> for the web interface</li>
          <li><strong>Explore the code</strong> - Check <code>app/api/sashi-app/</code> for implementation details</li>
        </ol>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#fff3cd', borderRadius: '8px' }}>
        <h3>🔗 Available Endpoints</h3>
        <ul>
          <li><code>/api/sashi-app/chat</code> - AI chat API endpoint</li>
          <li><code>/api/sashi-app/bot</code> - Interactive web interface</li>
          <li><code>/api/sashi-app/functions</code> - Available functions metadata</li>
        </ul>
      </div>
    </main>
  )
}