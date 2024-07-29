import bodyParser from "body-parser"
import cors from "cors"
import {Request, Response, Router} from "express"
import Redis from "ioredis"
import {validateSignedKey} from "./generate-token"
import {init} from "./init"
import {getAllConfigs, getConfig} from "./manage-config"

interface MiddlewareOptions {
    databaseUrl: string // Connection string for the database
    redisUrl: string
    accountId: string // Header name to extract the account ID from request headers
    secretKey: string
}

export interface DatabaseClient {
    query: (operation: string, details: any) => Promise<any>
}

const createMiddleware = (options: MiddlewareOptions) => {
    const {databaseUrl, redisUrl, accountId = "account-id", secretKey} = options

    init({accountId, databaseUrl, redisUrl})
    const redisClient = new Redis(redisUrl)
    const router = Router()

    router.use(cors())
    router.use(bodyParser.json())

    router.get("/s-controls/sanity-check", (req, res) => {
        res.json({message: "Sashi Middleware is running"})
        return
    })
    // Get data endpoint
    router.get(
        "/s-controls/configs/:key",
        async (req: Request, res: Response) => {
            const key: string = req.params.key
            console.log("Getting configs", key)

            const accountkey: string | undefined = req.headers[
                "account-key"
            ] as string

            const accountSignature: string | undefined = req.headers[
                "account-signature"
            ] as string

            if (!validateSignedKey(accountkey, accountSignature, secretKey)) {
                res.sendStatus(401).send("Unauthorized")
                return
            }

            if (!accountId) {
                return res
                    .status(400)
                    .json({message: "Account ID is required in headers"})
            }
            try {
                const {value} = await getConfig(key)
                res.json({key, value})
            } catch (error: any) {
                res.status(500).json({
                    message: "Failed to retrieve data",
                    error: error.message
                })
            }
        }
    )

    router.get("/s-controls/configs", async (req: Request, res: Response) => {
        console.log("Getting configs", "all")

        const accountkey: string | undefined = req.headers[
            "account-key"
        ] as string

        const accountSignature: string | undefined = req.headers[
            "account-signature"
        ] as string

        if (!validateSignedKey(accountkey, accountSignature, secretKey)) {
            res.sendStatus(401).send("Unauthorized")
            return
        }

        if (!accountId) {
            return res
                .status(400)
                .json({message: "Account ID is required in headers"})
        }

        try {
            const data = await getAllConfigs()

            res.json(data)
        } catch (error: any) {
            console.error("error", error.message)
            res.status(500).json({
                message: "Failed to retrieve data",
                error: error.message
            })
        }
    })

    // Set data endpoint
    router.post(
        "/s-controls/configs/:key",
        async (req: Request, res: Response) => {
            const key: string = req.params.key

            const accountkey: string | undefined = req.headers[
                "account-key"
            ] as string

            const accountSignature: string | undefined = req.headers[
                "account-signature"
            ] as string

            if (!validateSignedKey(accountkey, accountSignature, secretKey)) {
                res.sendStatus(401).send("Unauthorized")
                return
            }

            const {value} = req.body

            if (!accountId) {
                return res
                    .status(400)
                    .json({message: "Account ID is required in headers"})
            }

            try {
                await setConfig(key, value)
                res.json({key, value})
            } catch (error: any) {
                res.status(500).json({
                    message: "Failed to store data",
                    error: error.message
                })
            }
        }
    )

    // Endpoint to validate the key and signed key
    router.post("/s-controls/validate-key", (req, res) => {
        const {key, signature} = req.body
        const validated = validateSignedKey(key, signature, secretKey)

        res.json({valid: validated})
    })

    return router
}

export default createMiddleware
