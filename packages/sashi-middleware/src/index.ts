import express, {Request, Response, Router} from "express"
import bodyParser from "body-parser"
import cors from "cors"
import Redis from "ioredis"

interface MiddlewareOptions {
    databaseUrl: string // Connection string for the database
    redisUrl: string
    accountIdHeader: string // Header name to extract the account ID from request headers
}

interface DatabaseClient {
    query: (operation: string, details: any) => Promise<any>
}

const createDatabaseClient = (
    connectionString: string
): DatabaseClient & {protocol: string} => {
    const protocol = connectionString.split(":")[0]

    switch (protocol) {
        case "postgres":
            const {Pool} = require("pg")
            const pgClient = new Pool({connectionString})
            return {
                protocol,
                query: (sql, params) => pgClient.query(sql, params)
            }
        case "mysql":
            const mysql = require("mysql2/promise")
            const mysqlConnection = mysql.createPool(connectionString)
            return {
                protocol,
                query: (sql, params) => mysqlConnection.execute(sql, params)
            }
        case "mongodb":
        case "mongodb+srv":
            const {MongoClient} = require("mongodb")
            const client = new MongoClient(connectionString)
            return {
                protocol,
                query: async (operation, details) => {
                    await client.connect()
                    const db = client.db() // You may need to specify the DB name if not in the connection string
                    const collection = db.collection(details.collectionName)
                    switch (operation) {
                        case "find":
                            return await collection
                                .find(details.query)
                                .toArray()
                        case "insert":
                            return await collection.insertOne(details.document)
                        case "update":
                            return await collection.updateOne(details.query, {
                                $set: details.document
                            })
                        case "delete":
                            return await collection.deleteOne(details.query)
                        default:
                            throw new Error("Unsupported operation")
                    }
                }
            }
        default:
            throw new Error("Unsupported database type")
    }
}

const createMiddleware = (options: MiddlewareOptions) => {
    const {databaseUrl, redisUrl, accountIdHeader} = options
    const databaseClient = createDatabaseClient(databaseUrl)
    const redisClient = new Redis(redisUrl)
    const router = Router()

    router.use(cors())
    router.use(bodyParser.json())

    // Get data endpoint
    router.get("/hooks/:key", async (req: Request, res: Response) => {
        const key: string = req.params.key
        const accountId: string | undefined = req.headers[
            accountIdHeader
        ] as string

        if (!accountId) {
            return res
                .status(400)
                .json({message: "Account ID is required in headers"})
        }

        const cacheKey = `hooks:${accountId}:${key}`

        try {
            let value = await redisClient.get(cacheKey)

            if (!value) {
                const details = databaseClient.protocol.startsWith("mongodb")
                    ? {
                          collectionName: "hooks",
                          method: "find",
                          query: {accountId, key}
                      }
                    : {
                          sql: "SELECT value FROM hooks WHERE accountId = $1 AND key = $2",
                          params: [accountId, key]
                      }

                const result = await databaseClient.query("find", details)
                value = result?.[0]?.value || null // Adapt based on actual database response structure

                if (value) {
                    await redisClient.set(cacheKey, value, "EX", 3600) // Expires in 3600 seconds
                }
            }

            res.json({key, value})
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to retrieve data",
                error: error.message
            })
        }
    })

    // Set data endpoint
    router.post("/hooks/:key", async (req: Request, res: Response) => {
        const key: string = req.params.key
        const accountId: string | undefined = req.headers[
            accountIdHeader
        ] as string
        const {value} = req.body

        if (!accountId) {
            return res
                .status(400)
                .json({message: "Account ID is required in headers"})
        }

        const cacheKey = `hooks:${accountId}:${key}`

        try {
            const details = databaseClient.protocol.startsWith("mongodb")
                ? {
                      collectionName: "hooks",
                      method: "update",
                      query: {filter: {accountId, key}, update: {value}}
                  }
                : {
                      sql: "INSERT INTO hooks (accountId, key, value) VALUES ($1, $2, $3) ON CONFLICT (accountId, key) DO UPDATE SET value = EXCLUDED.value",
                      params: [accountId, key, value]
                  }

            await databaseClient.query("upsert", details)
            await redisClient.set(cacheKey, value, "EX", 3600) // Expires in 3600 seconds

            res.json({key, value})
        } catch (error: any) {
            res.status(500).json({
                message: "Failed to store data",
                error: error.message
            })
        }
    })

    return router
}

export default createMiddleware
