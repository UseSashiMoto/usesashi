import express, {Request, Response, Router} from "express"
import bodyParser from "body-parser"
import cors from "cors"

interface HookValues {
    [key: string]: any
}

const hooksMiddleware = (options: {} = {}) => {
    const router: Router = express.Router()
    const hookValues: HookValues = {}

    router.use(cors())
    router.use(bodyParser.json())

    router.get("/hooks/:key", (req: Request, res: Response) => {
        const key: string = req.params.key
        const value = hookValues[key] || null
        res.json({key, value})
    })

    router.post("/hooks/:key", (req: Request, res: Response) => {
        const key: string = req.params.key
        const {value} = req.body
        hookValues[key] = value
        res.json({key, value})
    })

    return router
}

export default hooksMiddleware
