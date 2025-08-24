import { useState } from 'react'
import Head from 'next/head'

export default function Home() {
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiType, setApiType] = useState<'pages' | 'app'>('pages')

  const sendMessage = async (message: string) => {
    setLoading(true)
    try {
      const endpoint = apiType === 'pages' ? '/api/sashi/chat' : '/api/sashi-app/chat'
      
      const res = await fetch(endpoint, {
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
    <>
      <Head>
        <title>Sashi Next.js Example</title>
        <meta name="description" content="Example Next.js app with Sashi integration" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <h1>🚀 Sashi Next.js Example</h1>
        <p>This example demonstrates both Next.js API Routes and App Router implementations.</p>

        <div style={{ marginBottom: '2rem' }}>
          <h2>API Type</h2>
          <label style={{ marginRight: '1rem' }}>
            <input
              type="radio"
              value="pages"
              checked={apiType === 'pages'}
              onChange={(e) => setApiType(e.target.value as 'pages')}
            />
            Pages API (/api/sashi/*)
          </label>
          <label>
            <input
              type="radio"
              value="app"
              checked={apiType === 'app'}
              onChange={(e) => setApiType(e.target.value as 'app')}
            />
            App Router (/api/sashi-app/*)
          </label>
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

        <div style={{ marginTop: '2rem', padding: '1rem', background: '#e8f4f8', borderRadius: '8px' }}>
          <h3>📖 Available Endpoints</h3>
          <ul>
            <li><strong>Pages API:</strong> <code>/api/sashi/*</code> - Traditional Next.js API routes</li>
            <li><strong>App Router:</strong> <code>/api/sashi-app/*</code> - New App Router API routes</li>
            <li><strong>Sashi Bot UI:</strong> <code>/api/sashi/bot</code> or <code>/api/sashi-app/bot</code></li>
          </ul>
          
          <h3>🔧 Test Commands</h3>
          <ul>
            <li>"Get all users" - Retrieve user list</li>
            <li>"Show me active users" - Filter active users</li>
            <li>"Get all content" - List content items</li>
            <li>"Create a user named John with email john@test.com" - Create user</li>
            <li>"Search for content about Next.js" - Content search</li>
          </ul>
        </div>
      </main>
    </>
  )
}