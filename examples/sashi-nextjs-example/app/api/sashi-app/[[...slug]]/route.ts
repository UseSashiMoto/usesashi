// Next.js App Router implementation for Sashi
import { createNextAppHandler } from '@sashimo/lib/nextjs'

// Import service modules to register functions
import '../../../../services/user-service'
import '../../../../services/content-service'

const handlers = createNextAppHandler({
  openAIKey: process.env.OPENAI_API_KEY!,
  apiSecretKey: process.env.SASHI_SECRET_KEY,
  hubUrl: process.env.SASHI_HUB_URL || 'https://hub.usesashi.com',
  debug: process.env.NODE_ENV === 'development'
})

// Export the HTTP methods you want to support
export const GET = handlers.GET
export const POST = handlers.POST
export const PUT = handlers.PUT
export const DELETE = handlers.DELETE
export const PATCH = handlers.PATCH
export const OPTIONS = handlers.OPTIONS