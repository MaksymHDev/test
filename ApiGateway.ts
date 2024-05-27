import express, { json, raw, Request, Response } from 'express'
import { config } from "dotenv";
import {logger } from "./util/logger-init.js";
import { SessionCache as redis } from "./util/redis.js";
import cors from 'cors'
import ORIGINS from "./config/origins.json" assert { type: "json" }

const session = redis
config()

export const app = express()
app.use(json())

if (process.env.ENABLE_CORS) app.use(cors({}))

app.post('/endpoint-registration', async (req: Request, res: Response) => {
    try {
        const {service, auth, endpoints} = req.body
        let origin = ORIGINS[service as keyof typeof ORIGINS]
        logger.http.info('A service initiated syncing endpoints', {service, host: origin})

        await Promise.all(Object.entries(endpoints).map(entry => {
            const [route, endpoint] = entry
            const key = service + '.' + endpoint

            if (process.env.ONLY_THIS_DOCKERIZED)
                origin = origin.replace('localhost', 'host.docker.internal')

            const val = origin + route
            logger.http.info(`Registered endpoint ${key} - ${val} `,)

            return session.set(key, val)
        }))

        res.status(200).json({message: "Registered endpoints successfully"})

    } catch (e) {

        logger.app.error(e)
        res.status(500).json({message: "Something failed while registering endpoints"})

    }
})

