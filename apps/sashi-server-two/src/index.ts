import { createMiddleware } from "@sashimo/lib"
import express from "express"
import { Express } from "express-serve-static-core"
import "./services/file_service"
import "./services/user_service"

require("dotenv").config()

const port = process.env.PORT || 3003

const app = express()

// Optional: Use JSON middleware if your middleware or routes need it
app.use(express.json())

// Function to list all routes
const listRoutes = (app: Express) => {
    const routes: any[] = []

    const printRoutes = (pathPrefix: string, layer: any) => {
        if (layer.route) {
            // This is a regular route
            const methods = Object.keys(layer.route.methods)
                .join(", ")
                .toUpperCase()
            routes.push(`${methods}: ${pathPrefix}${layer.route.path}`)
        } else if (layer.name === "router" && layer.handle.stack) {
            // This is a router middleware
            layer.handle.stack.forEach((subLayer: any) =>
                printRoutes(
                    pathPrefix +
                    (layer.regexp.source !== "^\\/?$"
                        ? layer.regexp.source
                            .replace(/\\\//g, "/")
                            .replace(/(\/\^|\/\(\?)/g, "")
                        : ""),
                    subLayer
                )
            )
        }
    }

    app._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
            // This is a regular route
            const methods = Object.keys(middleware.route.methods)
                .join(", ")
                .toUpperCase()
            routes.push(`${methods}: ${middleware.route.path}`)
        } else if (middleware.name === "router" && middleware.handle.stack) {
            // This is a router middleware
            middleware.handle.stack.forEach((layer: any) =>
                printRoutes(
                    middleware.regexp.source !== "^\\/?$"
                        ? middleware.regexp.source
                            .replace(/\\\//g, "/")
                            .replace(/(\/\^|\/\(\?)/g, "")
                        : "",
                    layer
                )
            )
        }
    })

    console.log("Routes:", process.env.NODE_ENV)
    routes.forEach((route) => {
        console.log(route)
    })
}

// Use sashi-middleware
app.use(
    "/sashi",
    createMiddleware({
        openAIKey: process.env.OPENAI_API_KEY || '',
        hubUrl: process.env.HUB_URL || 'http://localhost:3050',
        repos: ["usertwo-sub-to-userone"],
        apiSecretKey: process.env.API_SECRET_KEY || '',
    })
)

// Simple route to check server is running
app.get("/", (req, res) => {
    res.send("Hello from Sashi Express TypeScript Server!")
})

app.listen(process.env.PORT || 3003, () => {
    console.log(`Server running at http://localhost:${port}`)
    listRoutes(app)
})
