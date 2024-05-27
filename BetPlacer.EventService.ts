import { EtcdRegistry } from "mein-etcd-service-registry";
import { registry, sidecar } from "../init/registry.js";
import { config } from "dotenv";
import { logger } from "../init/logger.js";
import { IGameCrucial, IOddsObj } from "../ts/types.js";
import * as assert from "assert";

config()

export class EventServiceRemote {
    name: string
    registry: EtcdRegistry.ServiceRegistry

    constructor(registry: EtcdRegistry.ServiceRegistry, name: string) {
        this.registry = registry
    }

    async checkOdds(_id: string, data: IGameCrucial): Promise<boolean> {
        try {

            const check = await sidecar.sendRequest({
                method: 'post',
                endpoint: '/game/get',
                name: String(process.env.EVENT_SERVICE_NAME),
                params: {API_KEY: String(process.env.EVENT_SERVICE_KEY)}
            }, {_id: _id})

            if (!check) return false

            const target = {
                odds: check.data.data.odds,
                date: check.data.data.schedule.date,
                teams: check.data.data.teams
            }

            assert.deepStrictEqual(data, target, 'Eventdata unequal')
            return true
        } catch (e) {

            logger.app.error(e)
            if (e.message !== 'Eventdata unequal') throw e

            return false
        }
    }

    async getWon(_id: string): Promise<boolean | undefined> {
        try {
            const get = await sidecar.sendRequest({
                method: 'post',
                endpoint: '/games/get',
                name: String(process.env.EVENT_SERVICE_NAME),
                params: {API_KEY: String(process.env.EVENT_SERVICE_KEY)}
            }, {_id: _id})

            return get.data.data.status === 'final'
        } catch (e) {

            logger.app.error(e)
            return

        }
    }
}

export const events = new EventServiceRemote(registry, String(EVENT_SERVICE_NAME))
