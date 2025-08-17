import crypto from 'crypto'

// Generate secure tokens for testing
function generateSecureToken(prefix: string = 'token'): string {
    const randomBytes = crypto.randomBytes(32)
    const timestamp = Date.now()
    const hash = crypto.createHash('sha256')
        .update(`${prefix}-${timestamp}-${randomBytes.toString('hex')}`)
        .digest('hex')
    
    return `${prefix}_${hash.substring(0, 24)}`
}

function generateTestTokens() {
    console.log('🔐 Generating test authentication tokens...')
    console.log('')
    
    const tokens = {
        userToken: generateSecureToken('user'),
        adminToken: generateSecureToken('admin'),
        moderatorToken: generateSecureToken('mod'),
        demoToken: generateSecureToken('demo'),
        sessionToken: generateSecureToken('sess'),
        apiKey: generateSecureToken('api')
    }
    
    console.log('Generated tokens:')
    console.log('================')
    Object.entries(tokens).forEach(([name, token]) => {
        console.log(`${name.padEnd(15)}: ${token}`)
    })
    
    console.log('')
    console.log('Environment variables:')
    console.log('=====================')
    console.log(`USER_TOKEN=${tokens.userToken}`)
    console.log(`ADMIN_TOKEN=${tokens.adminToken}`)
    console.log(`MODERATOR_TOKEN=${tokens.moderatorToken}`)
    console.log(`DEMO_TOKEN=${tokens.demoToken}`)
    console.log(`SESSION_TOKEN=${tokens.sessionToken}`)
    console.log(`API_SECRET_KEY=${tokens.apiKey}`)
    
    console.log('')
    console.log('💡 Add these to your .env file for secure authentication')
    console.log('💡 The integration test server accepts these predefined tokens:')
    console.log('   - userone-session-token')
    console.log('   - usertwo-session-token') 
    console.log('   - admin-session-token')
    console.log('   - demo-session-token')
    
    return tokens
}

// Generate Hub API secret key
function generateHubApiKey(): string {
    const key = crypto.randomBytes(32).toString('hex')
    console.log('')
    console.log('🔑 Hub API Secret Key:')
    console.log('======================')
    console.log(key)
    console.log('')
    console.log('💡 Use this as HUB_API_SECRET_KEY in your environment')
    return key
}

// JWT-style token generator (for more realistic testing)
function generateJWTStyleToken(payload: Record<string, any>): string {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    }
    
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
    
    // Simple signature for testing (not cryptographically secure)
    const signature = crypto
        .createHash('sha256')
        .update(`${encodedHeader}.${encodedPayload}.test-secret`)
        .digest('base64url')
    
    return `${encodedHeader}.${encodedPayload}.${signature}`
}

function generateRealisticTokens() {
    console.log('')
    console.log('🎭 Generating realistic JWT-style tokens...')
    console.log('')
    
    const users = [
        { id: 'user_001', email: 'john@example.com', role: 'admin', name: 'John Doe' },
        { id: 'user_002', email: 'sarah@example.com', role: 'user', name: 'Sarah Wilson' },
        { id: 'user_003', email: 'michael@example.com', role: 'moderator', name: 'Michael Chen' },
        { id: 'user_004', email: 'demo@example.com', role: 'demo', name: 'Demo User' }
    ]
    
    users.forEach(user => {
        const payload = {
            sub: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        }
        
        const token = generateJWTStyleToken(payload)
        console.log(`${user.role.toUpperCase().padEnd(9)} (${user.email}):`)
        console.log(`${token}`)
        console.log('')
    })
    
    console.log('💡 These tokens can be used with Authorization: Bearer <token>')
}

// Main execution
if (require.main === module) {
    console.log('🛠️  Sashi Integration Test - Token Generator')
    console.log('===========================================')
    
    generateTestTokens()
    generateHubApiKey()
    generateRealisticTokens()
    
    console.log('✨ Token generation completed!')
}

export { 
    generateSecureToken, 
    generateTestTokens, 
    generateHubApiKey, 
    generateJWTStyleToken,
    generateRealisticTokens 
}