export * from "./ai-function-loader"
export * from "./default-functions"

// Legacy Express middleware (for backward compatibility)
export * from "./middleware"

// NEW: Web Standards Core System (recommended)
export * from "./core"

// Enhanced framework integrations using core
export * from "./express-core"
export * from "./nextjs-core"

// Legacy: Generic HTTP abstractions (for custom integrations)
export * from "./http/generic-middleware"
export * from "./http/generic-router"
export * from "./types/http"

// Legacy: Adapters (for custom integrations)
export { ExpressAdapter as LegacyExpressAdapter } from "./adapters/express-adapter"
export * from "./adapters/firebase-adapter"
export { NextApiAdapter as LegacyNextApiAdapter, NextAppRouterAdapter as LegacyNextAppRouterAdapter } from "./adapters/nextjs-adapter"

// Framework-specific exports
export { createExpressMiddleware, createMiddleware } from "./express"
export {
    createFirebaseCallableFunction, createFirebaseHttpFunction, createFirebaseRewriteFunction,
    createFirebaseV2Function
} from "./firebase"
export {
    createNextApiHandler,
    createNextAppHandler,
    createSingleMethodHandler
} from "./nextjs"



