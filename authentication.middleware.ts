import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken'
import { SecretService } from "../util/secret/secret.service";
import { RestrictionService } from "../modules/restrictions/restriction.service";
import { WinstonService } from "../modules/logger/winston.service";

@Injectable()
export class CheckAccess {
    constructor(
        private secretService: SecretService,
        private restrictionService: RestrictionService,
        private logger: WinstonService) {}

    async use(req: Request, res: Response, next: NextFunction) {
        try {
            if (req.originalUrl.match(/\/auth\/.*/)) return next()

            const token = req.header('Authorization').split(' ')[1]
            const check = await jwt.verify(token, this.secretService.data.jwt.bearer)

            if (!check) {
                await this.logger.log({message: "Failed jwt authentication", data: token, status: 401}, 'http')
                return res.status(401).json({
                    message: "Not authenticated"
                })
            }

            const restricted = await this.restrictionService.check(check.id)
            switch (restricted.type) {
                case('BLOCK'):
                    if ((Date.now() - Number(restricted.setAt)) > Number(restricted.timeout)) {
                        await this.restrictionService.declare(check.id, null)
                        return next()
                    }
                    return res.status(401).json({
                        message: `Blocked`
                    })
                case('PERMA'):
                    return res.status(401).json({
                        message: `Perma banished`
                    })
                default:
                    req.body.author = check.id
                    this.logger.log({message: "Authenticated ", data: {id: req.body.author}}, 'info')
                    return next()

            }
        } catch (err) {

            this.logger.log({message: err.message, data: err}, 'error')
            res.status(401).json({
                message: "Not authenticated"
            })

        }
    }
}

@Injectable()
export class CheckAdmin {
    constructor(
        private secretService: SecretService,
        private restrictionService: RestrictionService,
        private logger: WinstonService) {
    }

    async use(req: Request, res: Response, next: NextFunction) {
        try {

            const token = req.header('Authorization').split(' ')[1]
            const check = await jwt.verify(token, this.secretService.data.jwt.bearer)

            if (check.role !== 'ADMIN') {
                return res.status(401).json({
                    message: "Not admin"
                })
            }

            this.logger.log({message: 'Successful admin login', data: check})
            next()

        } catch(err) {

            this.logger.log({message: err.message, data: err}, 'error')
            res.status(401).json({
                message: "Not authenticated"
            })

        }
    }
}