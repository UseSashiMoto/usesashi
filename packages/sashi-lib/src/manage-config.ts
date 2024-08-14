import Redis from "ioredis"
import {createDatabaseClient} from "./createDatabaseClient"
import {settings} from "./init"

export async function setConfig(key: string, value: any) {
    const redisClient = new Redis(settings.getConfig().redisUrl)
    const databaseClient = createDatabaseClient(
        settings.getConfig().databaseUrl
    )

    const accountId = settings.getConfig().accountId

    const cacheKey = `sashi_configs:${accountId}:${key}`

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
}

export async function getConfig(key: string) {
    const redisClient = new Redis(settings.getConfig().redisUrl)
    const accountId = settings.getConfig().accountId
    const cacheKey = `sashi_configs:${accountId}:${key}`
    const databaseClient = createDatabaseClient(
        settings.getConfig().databaseUrl
    )

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

    return {key, value}
}

export async function getAllConfigs() {
    const databaseClient = createDatabaseClient(
        settings.getConfig().databaseUrl
    )

    const accountId = settings.getConfig().accountId || ""
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
    return data
}
