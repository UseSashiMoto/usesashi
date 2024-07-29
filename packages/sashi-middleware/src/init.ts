import Redis from "ioredis"
import {createDatabaseClient} from "./createDatabaseClient"

class Settings {
    private static instance: Settings
    private config: AppSettings | null = null

    private constructor() {}

    public static getInstance(): Settings {
        if (!Settings.instance) {
            Settings.instance = new Settings()
        }
        return Settings.instance
    }

    public init(config: AppSettings): void {
        if (this.config) {
            throw new Error("Configuration already initialized")
        }

        this.config = config
    }

    public getConfig(): AppSettings {
        if (!this.config) {
            throw new Error("Configuration not initialized")
        }

        createDatabaseClient(this.config.databaseUrl)
        const redisClient = new Redis(this.config.redisUrl)
        redisClient.connect()
        return this.config
    }
}

export const settings = Settings.getInstance()

export interface AppSettings {
    accountId: string
    databaseUrl: any
    redisUrl: any
}
export const init = async ({
    accountId,
    databaseUrl,
    redisUrl
}: {
    accountId: string
    databaseUrl: any
    redisUrl: any
}) => {
    settings.init({
        accountId,
        databaseUrl,
        redisUrl
    })
}
