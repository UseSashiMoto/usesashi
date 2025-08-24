/**
 * Core business logic handlers for Sashi endpoints
 * Pure Web Standards functions - framework agnostic
 */

import { SashiRequest, SashiError, JsonResponse } from './types'
import { getFunctionRegistry, getFunctionAttributes } from '../ai-function-loader'
import { MetaData } from '../models/repo-metadata'

/**
 * Creates a JSON response with proper headers
 */
function createJsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  })
}

/**
 * Creates an error response
 */
function createErrorResponse(error: string, details?: string, status: number = 400): Response {
  const errorResponse: SashiError = {
    error,
    details,
    timestamp: new Date().toISOString()
  }
  
  return createJsonResponse(errorResponse, status)
}

/**
 * Health check endpoint - returns 200 if service is running
 */
export async function handleSanityCheck(_request: SashiRequest): Promise<Response> {
  return createJsonResponse({ 
    message: 'Sashi Middleware is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'unknown'
  })
}

/**
 * Ping endpoint with API token validation
 */
export async function handlePing(request: SashiRequest): Promise<Response> {
  const apiToken = request.headers.get('x-api-token')
  const expectedToken = request.sashiContext.metadata?.apiSecretKey
  
  if (!expectedToken) {
    return createErrorResponse(
      'API secret key not configured',
      'Server is not configured with an API secret key',
      500
    )
  }
  
  if (apiToken !== expectedToken) {
    return createErrorResponse(
      'Unauthorized',
      'Invalid or missing API token',
      401
    )
  }
  
  return createJsonResponse({
    message: 'Sashi Middleware is running',
    token: apiToken,
    timestamp: new Date().toISOString()
  })
}

/**
 * Metadata endpoint - returns available functions and hub information
 */
export async function handleMetadata(request: SashiRequest): Promise<Response> {
  try {
    const hubUrl = request.sashiContext.metadata?.hubUrl || 'https://hub.usesashi.com'
    
    // Get function registry
    const functionRegistry = getFunctionRegistry()
    const functionAttributes = getFunctionAttributes()
    
    // Build metadata response
    const metadata: MetaData = {
      hubUrl: hubUrl,
      functions: Array.from(functionRegistry.values())
        .filter(func => {
          const functionAttribute = functionAttributes.get(func.getName())
          // Filter out hidden functions from UI metadata
          return !functionAttribute?.isHidden
        })
        .map((func) => {
          const functionAttribute = functionAttributes.get(func.getName())
          
          return {
            name: func.getName(),
            description: func.getDescription(),
            needConfirmation: func.getNeedsConfirm(),
            active: functionAttribute?.active ?? true,
            isVisualization: false,
          }
        }),
    }
    
    return createJsonResponse(metadata)
  } catch (error) {
    console.error('Error generating metadata:', error)
    return createErrorResponse(
      'Internal server error',
      'Failed to generate metadata',
      500
    )
  }
}

/**
 * Hub connection check endpoint
 */
export async function handleHubConnectionCheck(request: SashiRequest): Promise<Response> {
  const hubUrl = request.sashiContext.metadata?.hubUrl
  const apiSecretKey = request.sashiContext.metadata?.apiSecretKey
  const debug = request.sashiContext.debug
  
  if (!hubUrl || !apiSecretKey) {
    return createJsonResponse({
      connected: false,
      error: 'Hub URL or API secret key not configured'
    })
  }
  
  try {
    // Test connection to hub
    const response = await fetch(`${hubUrl}/ping`, {
      headers: {
        'x-api-token': apiSecretKey,
      },
    })
    
    const connected = response.status === 200
    
    const result: any = { connected }
    
    if (debug) {
      result.connectionInfo = {
        hubUrl: hubUrl,
        status: response.status,
        statusText: response.statusText,
        hasCredentials: !!(hubUrl && apiSecretKey),
        lastChecked: new Date().toISOString()
      }
    }
    
    return createJsonResponse(result)
  } catch (error) {
    console.error('Hub connection check failed:', error)
    return createJsonResponse({
      connected: false,
      error: 'Failed to connect to hub',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Function toggle endpoint
 */
export async function handleFunctionToggle(request: SashiRequest): Promise<Response> {
  const functionId = request.sashiContext.params.function_id
  
  if (!functionId) {
    return createErrorResponse(
      'Function ID is required',
      'Missing function_id parameter',
      400
    )
  }
  
  const functionRegistry = getFunctionRegistry()
  const func = functionRegistry.get(functionId)
  
  if (!func) {
    return createErrorResponse(
      'Function not found',
      `Function with ID "${functionId}" does not exist`,
      404
    )
  }
  
  try {
    // Import the toggle function dynamically to avoid circular dependencies
    const { toggleFunctionActive } = await import('../ai-function-loader')
    toggleFunctionActive(functionId)
    
    return createJsonResponse({
      message: 'Function toggled successfully',
      functionId: functionId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error toggling function:', error)
    return createErrorResponse(
      'Failed to toggle function',
      error instanceof Error ? error.message : 'Unknown error',
      500
    )
  }
}

/**
 * Test error handling endpoint
 */
export async function handleTestError(request: SashiRequest): Promise<Response> {
  try {
    const body = await request.json()
    const { testType } = body
    
    console.log(`[Test] Testing error handling type: ${testType}`)
    
    switch (testType) {
      case 'timeout':
        // Simulate a timeout
        await new Promise(resolve => setTimeout(resolve, 2000))
        return createJsonResponse({
          success: true,
          message: 'Timeout test completed - if you see this, timeouts are working correctly',
          testType: 'timeout'
        })
        
      case 'error':
        // Simulate an error
        throw new Error('Test error - error handling is working correctly')
        
      case 'validation':
        // Test validation
        if (!body.requiredField) {
          return createErrorResponse(
            'Missing required field',
            'This is a test validation error to verify error handling is working',
            400
          )
        }
        return createJsonResponse({
          success: true,
          message: 'Validation test passed',
          testType: 'validation'
        })
        
      default:
        return createErrorResponse(
          'Unknown test type',
          'Available test types: timeout, error, validation',
          400
        )
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Test error')) {
      // This is our intentional test error
      return createErrorResponse(
        'Test error',
        error.message,
        500
      )
    }
    
    // Unexpected error
    console.error('Unexpected error in test handler:', error)
    return createErrorResponse(
      'Internal server error',
      'An unexpected error occurred during testing',
      500
    )
  }
}
