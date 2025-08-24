/**
 * Express integration using Sashi Core
 * This maintains backward compatibility while using the new Web Standards core
 */

import { Router } from 'express'
import { createSashiCore, SashiCoreImpl } from './core/core'
import { createExpressMiddleware } from './core/adapters/express-adapter'
import { SashiCoreOptions } from './core/types'
import { MiddlewareOptions } from './middleware' // Import existing options for compatibility

// Re-export core types for users who want them
export { SashiCore, SashiCoreOptions, SashiContext, SashiRequest, SashiRoute } from './core/types'
export { createSashiCore } from './core/core'

/**
 * Create Express middleware using the new core system
 * This is the new recommended way - cleaner and more performant
 */
export function createExpressMiddlewareFromCore(options: SashiCoreOptions): Router {
  // Initialize OpenAI and other services (from original middleware)
  const { setDefaultOpenAIKey } = require("@openai/agents")
  const { createAIBot } = require("./aibot")
  
  try {
    setDefaultOpenAIKey(options.openAIKey)
    console.log('✅ OpenAI agents library configured successfully')
  } catch (error) {
    console.error('❌ Failed to configure OpenAI agents library:', error)
    throw new Error(`Failed to configure OpenAI agents: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  createAIBot({ 
    apiKey: options.openAIKey, 
    sashiSecretKey: options.apiSecretKey, 
    hubUrl: options.hubUrl 
  })
  
  // Create core instance
  const core = createSashiCore(options)
  
  // Create Express middleware
  const middleware = createExpressMiddleware(core)
  
  // Create Express router
  const router = Router()
  
  // Apply the core middleware to all routes
  router.use(middleware)
  
  return router
}

/**
 * Backward compatibility adapter
 * Converts old MiddlewareOptions to new SashiCoreOptions
 */
function adaptLegacyOptions(options: MiddlewareOptions): SashiCoreOptions {
  return {
    openAIKey: options.openAIKey,
    debug: options.debug,
    sashiServerUrl: options.sashiServerUrl,
    apiSecretKey: options.apiSecretKey,
    hubUrl: options.hubUrl,
    langFuseInfo: options.langFuseInfo,
    sessionSecret: options.sessionSecret,
    // Convert Express-specific functions to Web Standards
    getSession: options.getSession ? async (request, context) => {
      // This is a simplification - in practice we'd need to access the original Express req/res
      // For now, we'll indicate this needs the legacy path
      throw new Error('Legacy getSession function detected - please use createMiddleware for full compatibility')
    } : undefined,
    validateSession: options.validateSession ? async (sessionToken, request, context) => {
      // Same issue as above
      throw new Error('Legacy validateSession function detected - please use createMiddleware for full compatibility')
    } : undefined,
  }
}

/**
 * Enhanced middleware factory that automatically chooses the best approach
 * - Uses new core system if options are compatible
 * - Falls back to legacy system if custom session functions are provided
 */
export function createEnhancedExpressMiddleware(options: MiddlewareOptions): Router {
  // Check if we can use the new core system
  const hasLegacyFunctions = options.getSession || options.validateSession
  
  if (hasLegacyFunctions) {
    console.log('🔄 Using legacy middleware system (custom session functions detected)')
    // Import and use the original middleware
    const { createMiddleware } = require('./middleware')
    return createMiddleware(options)
  } else {
    console.log('🚀 Using new core system for better performance')
    // Use new core system
    const coreOptions = adaptLegacyOptions(options)
    return createExpressMiddlewareFromCore(coreOptions)
  }
}
