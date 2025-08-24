// Next.js API Routes implementation for Sashi
import { createNextApiHandler } from '@sashimo/lib/nextjs'

// Import service modules to register functions
import '../../../services/user-service'
import '../../../services/content-service'

const handler = createNextApiHandler({
  openAIKey: process.env.OPENAI_API_KEY!,
  apiSecretKey: process.env.SASHI_SECRET_KEY,
  hubUrl: process.env.SASHI_HUB_URL || 'https://hub.usesashi.com',
  debug: process.env.NODE_ENV === 'development'
})

export default handler