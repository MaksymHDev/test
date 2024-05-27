import { Redis } from "ioredis"
import { AppCache as redis } from "./redis.js"
import { config } from "dotenv"
import { logger } from "./logger-init.js"

config()

interface RedisOptions {
    path?: string
    options?: {}
}

interface Options {
    maxmemory: number,
    maxmemory_pol: string,
    ttl?: number
}

interface IdentifiableDataI {
    _id: string | number
}

function parseFromRedisMemInfo(param: string, info_mem: string): number {
    const mem_found = info_mem.slice(info_mem.search(param)).match(/[\d\w.]*(?=\r\n)/)
    if (!mem_found)
        throw new Error('Redis info check fail')

    const mem_stat = mem_found[0]
    const metric = mem_stat.match(/[KMG]/)
    if (!metric)
        return Number(mem_stat)

    switch (metric[0]) {
        case 'K':
            return Number(mem_stat) * 1000
        case 'M':
            return Number(mem_stat) * 1000000
        case 'G':
            return Number(mem_stat) * 1000000000
        default:
            return Number(mem_stat)
    }
}

function getPercentsMemStat(stat1: number, stat2: number, critical: number) {
    return 100 - stat1 / (stat2 / 100) >= critical
}

export class RedisCacheManager {
    redis: Redis
    options: Options

    constructor(url: string, connect_options: RedisOptions, options: Options, redis?: Redis) {
        this.redis = redis || new Redis(url, connect_options)
        this.options = options
    }

    async init() {
        const info_mem = await this.redis.info('memory')
        const used_mem_val = parseFromRedisMemInfo('used_memory', info_mem)
        const used_mem_start = parseFromRedisMemInfo('used_memory_startup', info_mem)
        const occ_k = getPercentsMemStat(used_mem_start, used_mem_val, 5)
        if(used_mem_val >= this.options.maxmemory && occ_k) {
            await this.redis.flushall()
            logger.app.info('Flushed Cache')
        }

        if(used_mem_val >= this.options.maxmemory && !occ_k){
            throw new Error('Supplied param "maxmemory" for cache config is smaller than on startup memory usage, please reconsider')
        }

        await this.redis.config('SET', 'maxmemory', this.options.maxmemory)
        await this.redis.config('SET', 'maxmemory-policy', this.options.maxmemory_pol)
    }

    async put(token: string, data: IdentifiableDataI) {
        const id = token + data._id
        const to_set = JSON.stringify(data)
        const res = await this.redis.set(id, to_set)
        if (this.options.ttl)
            await this.redis.expire(id, String(this.options.ttl))

        return res
    }

    async get(token: string, id_obj: IdentifiableDataI) {
        const id = id_obj._id

        return this.redis.get(token + id)
    }
}

const OPTS = {
    maxmemory: 1100000,
    maxmemory_pol: 'allkeys-lru',
    ttl: 24 * 60 * 60 * 60
}

export const redisCache = new RedisCacheManager('', {}, OPTS, redis)
