import {Request, Response, Router} from "express"
import bodyParser from "body-parser"
import cors from "cors"
import Redis from "ioredis"
import { validateSignedKey } from "./generate-token";



interface MiddlewareOptions {
    databaseUrl: string // Connection string for the database
    redisUrl: string
    accountIdHeader: string // Header name to extract the account ID from request headers
    secretKey: string
}

interface DatabaseClient {
    query: (operation: string, details: any) => Promise<any>
}

const createDatabaseClient = (
    connectionString: string
): DatabaseClient & {protocol: string} => {
    const protocol = connectionString.split(":")[0]
    console.log("protocol", protocol)

    switch (protocol) {
        case "postgresql":
        case "postgres":
            const {Pool} = require("pg")
            const pgClient = new Pool({connectionString})

            return {
                protocol,
                query:async (operation, params) => {
                    console.log("db query", operation, params, Array.isArray(params), Object.keys(params))
                    return (await pgClient.query(params['sql'], params['params'])).rows
                }
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
    const {databaseUrl, redisUrl, accountIdHeader="account-id", secretKey} = options
    const databaseClient = createDatabaseClient(databaseUrl)
    const redisClient = new Redis(redisUrl)
    const router = Router()

    router.use(cors())
    router.use(bodyParser.json())

    router.get("/s-controls/sanity-check", (req, res) => {

        res.json({message: "Sashi Middleware is running"})
        return
    })
    // Get data endpoint
    router.get("/s-controls/configs/:key", async (req: Request, res: Response) => {
        const key: string = req.params.key
        console.log("Getting configs", key)

        const accountId: string | undefined = req.headers[
            accountIdHeader
        ] as string

        const accountkey: string | undefined = req.headers[
           "account-key"
        ] as string


        const accountSignature: string | undefined = req.headers[
            "account-signature"
         ] as string

        if(!validateSignedKey(accountkey, accountSignature, secretKey)){
            res.sendStatus(401).send("Unauthorized");
            return
        }

        if (!accountId) {
            return res
                .status(400)
                .json({message: "Account ID is required in headers"})
        }

        const cacheKey = `sashi_configs:${accountId}:${key}`

        try {
            let value = await redisClient.get(cacheKey)

            if (!value) {
                const details = databaseClient.protocol.startsWith("mongodb")
                    ? {
                          collectionName: "sashi_configs",
                          method: "find",
                          query: {accountId, key}
                      }
                    : {
                          sql: "SELECT value FROM sashi_configs WHERE accountId = $1 AND key = $2",
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


    router.get("/s-controls/configs", async (req: Request, res: Response) => {
        console.log("Getting configs", "all")

        const accountId: string | undefined = req.headers[
            accountIdHeader
        ] as string

        const accountkey: string | undefined = req.headers[
            "account-key"
         ] as string
 
 
         const accountSignature: string | undefined = req.headers[
             "account-signature"
          ] as string
 
         if(!validateSignedKey(accountkey, accountSignature, secretKey)){
             res.sendStatus(401).send("Unauthorized");
             return
         }

        if (!accountId) {
            return res
                .status(400)
                .json({message: "Account ID is required in headers"})
        }

        try {
            const details = databaseClient.protocol.startsWith("mongodb")
                ? {
                      collectionName: "sashi_configs",
                      method: "find",
                      query: {accountId}
                  }
                : {
                      sql: "SELECT key, value FROM sashi_configs WHERE accountId = $1",
                      params: [accountId]
                  }

            console.log("details retrieved", details)

            const result = await databaseClient.query("find", details)

            console.log("sashi_configs results", result)
            const data = result.map((item: any) => ({
                key: item.key,
                value: item.value
            }))

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
    router.post("/s-controls/configs/:key", async (req: Request, res: Response) => {
        const key: string = req.params.key
        const accountId: string | undefined = req.headers[
            accountIdHeader
        ] as string


        const accountkey: string | undefined = req.headers[
            "account-key"
         ] as string
 
 
         const accountSignature: string | undefined = req.headers[
             "account-signature"
          ] as string
 
         if(!validateSignedKey(accountkey, accountSignature, secretKey)){
             res.sendStatus(401).send("Unauthorized");
             return
         }

        const {value} = req.body

        if (!accountId) {
            return res
                .status(400)
                .json({message: "Account ID is required in headers"})
        }

        const cacheKey = `sashi_configs:${accountId}:${key}`

        try {
            const details = databaseClient.protocol.startsWith("mongodb")
                ? {
                      collectionName: "sashi_configs",
                      method: "update",
                      query: {filter: {accountId, key}, update: {value}}
                  }
                : {
                      sql: "INSERT INTO sashi_configs (accountId, key, value) VALUES ($1, $2, $3) ON CONFLICT (accountId, key) DO UPDATE SET value = EXCLUDED.value",
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
    
    // Endpoint to validate the key and signed key
    router.post('/s-controls/validate-key', (req, res) => {
        const { key, signature } = req.body;
        const validated = validateSignedKey(key, signature, secretKey)
    
        res.json({ valid: validated });
   
    });

    return router
}

export default createMiddleware
