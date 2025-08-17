const ngrok = require('ngrok')
require('dotenv').config()

const port = process.env.PORT || 3010
const subdomain = process.env.NGROK_SUBDOMAIN || 'sashi-integration-test'
const authToken = process.env.NGROK_AUTH_TOKEN

async function startNgrok() {
    try {
        console.log('🌐 Starting ngrok tunnel...')
        
        const options = {
            proto: 'http',
            addr: port,
            subdomain: subdomain,
            region: 'us'
        }

        if (authToken) {
            options.authtoken = authToken
        }

        const url = await ngrok.connect(options)
        
        console.log(`✅ Ngrok tunnel established!`)
        console.log(`🔗 Public URL: ${url}`)
        console.log(`🤖 Sashi Bot URL: ${url}/sashi/bot`)
        console.log(`📊 Health Check: ${url}/health`)
        console.log(`📚 API Docs: ${url}/docs`)
        console.log('')
        console.log('Press Ctrl+C to stop the tunnel')

        // Handle cleanup
        process.on('SIGINT', async () => {
            console.log('\\n🛑 Stopping ngrok tunnel...')
            await ngrok.kill()
            process.exit(0)
        })

        process.on('SIGTERM', async () => {
            console.log('\\n🛑 Stopping ngrok tunnel...')
            await ngrok.kill()
            process.exit(0)
        })

    } catch (error) {
        console.error('❌ Failed to start ngrok tunnel:', error.message)
        
        if (error.message.includes('tunnel already established')) {
            console.log('💡 Try running "ngrok kill" to close existing tunnels')
        } else if (error.message.includes('authentication failed')) {
            console.log('💡 Please check your NGROK_AUTH_TOKEN in the .env file')
            console.log('💡 Get your auth token from: https://dashboard.ngrok.com/get-started/your-authtoken')
        } else if (error.message.includes('subdomain')) {
            console.log('💡 The subdomain might be taken. Try changing NGROK_SUBDOMAIN in .env')
        }
        
        process.exit(1)
    }
}

startNgrok()