import { Server, Socket } from "socket.io";
import { app } from "./app.js";
import * as http from "http";
import axios from "axios";
import { logger } from "./util/logger-init.js";
import { SessionCache as redis } from "./util/redis.js";
import { shortRateLimiterMiddleware } from "./util/rate-limiter.js";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { redisCache } from "./util/Cache.js";

const session = redis
const server = http.createServer(app)
export const io = new Server(server, {})

io.use(shortRateLimiterMiddleware)
io.engine.use((req, res, next) =>
    shortRateLimiterMiddleware(<Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, unknown>><unknown>req.socket, next))

io.on('connection', (socket) => {
    logger.http.info('New client connected ' + socket.handshake.address)

    socket.on('access-endpoint', async (token, data) => {
        try {
            const url = await session.get(token)
            if (!url)
                return socket.emit('response', {
                    error: 'Cannot get ' + token + ', no such endpoint found',
                    status: 404
                })

            const redirect_req = {data, require_cache: false}
            let cache_res: boolean = false

            const [action] = token.split('.').slice(-1)
            const [route_key] = token.split(action)

            switch (action) {
                case 'put':
                case 'post':
                    logger.app.debug('Cache write initiated')
                    redirect_req.require_cache = true
                    cache_res = true

                    break;
                case 'get':
                    const cached = await redisCache.get(route_key, data)
                    if (!cached) {
                        logger.app.debug('Cache miss for : ' + token, data)
                        break;
                    }

                    logger.app.debug('Cache hit for : ' + token, data)

                    return socket.emit('response', 'Retrieved from cache', cached)
            }

            const response = await axios.post(url, redirect_req, {})
            socket.emit('response', response.data.message, response.data.data)

            const to_cache = response.data.to_cache
            if (cache_res && to_cache)
                await redisCache.put(route_key, to_cache)

        } catch (e) {

            logger.app.error(e)
            socket.emit('response', {error: 'Server error', status: 500})

        }
    })
})
