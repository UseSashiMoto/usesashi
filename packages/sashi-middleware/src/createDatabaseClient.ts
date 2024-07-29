import {DatabaseClient} from "./middleware"

export const createDatabaseClient = (
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
                query: async (operation, params) => {
                    console.log(
                        "db query",
                        operation,
                        params,
                        Array.isArray(params),
                        Object.keys(params)
                    )
                    return (
                        await pgClient.query(params["sql"], params["params"])
                    ).rows
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
