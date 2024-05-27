import axios from "axios";
import { LoggerService, WinstonLoggerService } from "mein-winston-logger";
import { Etcd3, IOptions } from "etcd3";

export interface IRegistryData {
    serviceUrl: string;
    refer: string;
    endpoints: TApiObjectT;
}

export interface IConfigOptions extends IOptions {}

export type TApiObjectT = {
    [key: string]: string;
}

export class ServiceRegistry {
    etcd: Etcd3;
    namespace: string = 'services/';
    logger: LoggerService;

    constructor(config: IConfigOptions,) {
        this.logger = new WinstonLoggerService({
            path: "./logs",
            console: true,
            maxsize: 59999
        });

        this.etcd = new Etcd3({
            hosts: config.hosts,
            auth: config.auth,
            credentials: config.credentials,
        });
    }

    async startService(data: IRegistryData) {
        const nmspc = this.etcd.namespace(this.namespace).namespace(data.refer);

        await nmspc.put('name').value(data.serviceUrl).exec();
        await nmspc.put('endpoints').value(JSON.stringify(data.endpoints)).exec();
    }

    async route(endpoint_token: string) {
        const parsed_token = endpoint_token.split('.');
        const service = parsed_token[0];
        const endpoint = parsed_token.slice(1).join('.');
        const nmspc = this.etcd.namespace(this.namespace).namespace(service);
        const name = await nmspc.get('name');
        const endpoints = await nmspc.get('endpoints').json();

        if (!endpoints && !name)
            throw new Error('No endpoint registered for this token');

        return endpoints[endpoint];
    }
}

