/**
 * Next.js integration using Sashi Core
 * Much cleaner and more performant than the previous approach
 */

import { createSashiCore } from './core/core'
import { createNextAppHandler as createNextAppHandlerFromAdapter, createNextApiHandler as createNextApiHandlerFromAdapter } from './core/adapters/nextjs-adapter'
import { SashiCoreOptions } from './core/types'

// Re-export core types
export { SashiCore, SashiCoreOptions, SashiContext, SashiRequest, SashiRoute } from './core/types'
export { createSashiCore } from './core/core'

/**
 * Next.js-specific middleware options (backward compatibility)
 */
export interface NextMiddlewareOptions extends SashiCoreOptions {
  // Next.js-specific options can be added here
}

/**
 * Initialize Sashi services (OpenAI, etc.)
 */
function initializeSashiServices(options: SashiCoreOptions) {
  const { setDefaultOpenAIKey } = require("@openai/agents")
  const { createAIBot } = require("./aibot")
  
  try {
    setDefaultOpenAIKey(options.openAIKey)
    if (options.debug) {
      console.log('✅ OpenAI agents library configured successfully')
    }
  } catch (error) {
    console.error('❌ Failed to configure OpenAI agents library:', error)
    throw new Error(`Failed to configure OpenAI agents: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  createAIBot({ 
    apiKey: options.openAIKey, 
    sashiSecretKey: options.apiSecretKey, 
    hubUrl: options.hubUrl || 'https://hub.usesashi.com'
  })
  
  if (options.debug) {
    console.log('🚀 Sashi Core initialized for Next.js')
  }
}

/**
 * Create Next.js App Router handlers using the core system
 */
export function createNextAppHandlerFromCore(options: NextMiddlewareOptions) {
  // Initialize services
  initializeSashiServices(options)
  
  // Create core instance
  const core = createSashiCore(options)
  
  // Create Next.js App Router handlers
  return createNextAppHandlerFromAdapter(core)
}

/**
 * Create Next.js API Routes handler using the core system
 */
export function createNextApiHandlerFromCore(options: NextMiddlewareOptions) {
  // Initialize services
  initializeSashiServices(options)
  
  // Create core instance
  const core = createSashiCore(options)
  
  // Create Next.js API handler
  return createNextApiHandlerFromAdapter(core)
}

/**
 * Convenience function for single-method API routes
 */
export function createSingleMethodHandlerFromCore(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  options: NextMiddlewareOptions
) {
  const handlers = createNextAppHandlerFromCore(options)
  return handlers[method]
}

/**
 * Backward compatibility exports
 * These will use the new core system but maintain the same API
 */
export const createNextAppHandler = createNextAppHandlerFromCore
export const createNextApiHandler = createNextApiHandlerFromCore
export const createSingleMethodHandler = createSingleMethodHandlerFromCore
