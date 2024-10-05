import {createMiddleware} from "@sashimo/lib"
import express, {NextFunction, Request, Response} from "express"
import {Express} from "express-serve-static-core"
import "./services/file_service"
import "./services/user_service"

require("dotenv").config()

const app = express()
const port = 3002

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

// Global CORS setup before all routes
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*") // Or specific origins
    res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
    )
    res.header(
        "Access-Control-Allow-Headers",
        "x-sashi-session-token, Content-Type"
    )

    // Handle preflight requests
    if (req.method === "OPTIONS") {
        return res.status(200).end()
    }

    next()
})

const verifySessionMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const sessionToken = req.headers["x-sashi-session-token"]

    if (!sessionToken) {
        return res.status(401).send("Unauthorized")
    }

    // Verify the session token
    if (sessionToken !== "userone-session-token") {
        return res.status(401).send("Unauthorized")
    }

    next()
}

// Use sashi-middleware
app.use(
    "/sashi",
    verifySessionMiddleware,
    createMiddleware({
        openAIKey: process.env.OPENAI_API_KEY || "",
        repos: ["userone-sub-to-usertwo"],
        hubUrl: "http://localhost:5002",
        apiSecretKey: "userone-api-token",
        repoSecretKey: "useronereposecret",
        getSession: async (req, res) => {
            return "userone-session-token"
        }
    })
)

// Simple route to check server is running
app.get("/", (req, res) => {
    res.send("Hello from Sashi Express TypeScript Server!")
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`)
    listRoutes(app)
})
