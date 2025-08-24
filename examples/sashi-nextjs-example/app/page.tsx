'use client'

import { useState } from 'react'

export default function AppRouterPage() {
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async (message: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/sashi-app/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sashi-session-token': 'app-router-demo-session'
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
    { name: 'Create User', message: 'Create a new user named "App Router User" with email approuter@example.com' },
    { name: 'Create Content', message: 'Create a new tutorial titled "App Router Guide" about Next.js App Router by "Next.js Team"' },
  ]

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🚀 Sashi Next.js App Router Example</h1>
      <p>This page demonstrates the App Router implementation of Sashi integration.</p>
      
      <div style={{ marginBottom: '2rem', padding: '1rem', background: '#e8f4f8', borderRadius: '8px' }}>
        <h3>🎯 App Router Features</h3>
        <ul>
          <li>Uses the new <code>app/</code> directory structure</li>
          <li>Server and Client Components</li>
          <li>Built-in layouts and nested routing</li>
          <li>API endpoint: <code>/api/sashi-app/*</code></li>
        </ul>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Test Functions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {testFunctions.map((func, index) => (
            <button
              key={index}
              onClick={() => sendMessage(func.message)}
              disabled={loading}
              style={{
                padding: '1rem',
                border: '1px solid #ccc',
                borderRadius: '8px',
                backgroundColor: '#f5f5f5',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {func.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Custom Message</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Enter your message..."
            style={{ flex: 1, padding: '0.5rem', fontSize: '1rem' }}
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
              sendMessage(input.value)
              input.value = ''
            }}
            disabled={loading}
            style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      <div>
        <h2>Response</h2>
        <pre style={{
          background: '#f5f5f5',
          padding: '1rem',
          borderRadius: '8px',
          overflow: 'auto',
          maxHeight: '400px',
          whiteSpace: 'pre-wrap'
        }}>
          {response || 'No response yet. Click a button or send a message above.'}
        </pre>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>🔗 Navigation</h3>
        <p>
          <a href="/" style={{ color: '#0070f3', textDecoration: 'underline' }}>
            ← Back to Pages Router example
          </a>
        </p>
      </div>
    </main>
  )
}