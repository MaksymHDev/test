import { LoggerService } from "mein-winston-logger";
import { bets, BetService } from "../services/Bet.service.js";
import { logger } from "../init/logger.js";
import { Request, Response } from "express";
import { events, EventServiceRemote } from "../services/Event.service.js";
import { config } from "dotenv";
import { leaveBetTransaction } from "../transactions.js";

config()

export class BetController {
    logger: LoggerService
    service: BetService
    remoteEvents: EventServiceRemote

    constructor(service: BetService, remoteEvents: EventServiceRemote, logger: LoggerService) {
        this.logger = logger
        this.service = service
        this.remoteEvents = remoteEvents
    }

    async get(req: Request, res: Response) {
        try {
            const {outcome, team, money, event, user} = req.body.bet
            const betContext = req.body.betContext
            const check = await this.remoteEvents.checkOdds(event, betContext)

            if (!check)
                return res.status(400).json({
                    message: 'Data irrelevant',
                    description: 'Data for bet irrelevant, can\'t proceed with transaction '
                })

            const bet = await this.service.bet({outcome, team, money, event, settled: false, won: false, user})
            const trans_LEAVE_BET = await leaveBetTransaction({bet, money, user, date: Date()})

            if(!trans_LEAVE_BET) return res.status(404).json({message: 'Error on transaction'})

            res.status(200).json({message: 'Successfully left bet'})

        } catch (e) {

            this.logger.app.error(e)
            res.status(500).json({message: 'Server error'})

        }
    }
}

export const betsController = new BetController(bets, events, logger)
