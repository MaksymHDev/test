import { Injectable } from "@nestjs/common"
import { createLogger, transports, format } from "winston"

@Injectable()
export class WinstonService {
    logger: Logger

    constructor() {
        switch (process.env.LOGGER_ENV) {
            case("dev"):
                const LOG_DIR = 'logs'
                this.logger = new WinstonLogger([
                    new transports.Console({
                        level: 'debug'
                    }),
                    new transports.File({
                        filename: `${LOG_DIR}/combined.log`,
                        level: 'info',
                        maxsize: 5242880, // 5MB
                    },),
                    new transports.File({
                        filename: `${LOG_DIR}/app-err.log`,
                        level: "error",
                        maxsize: 5242880, // 5MB
                    }),
                ])
                break;
            case("production"):
                break;
        }
    }

    log(data, logger = null) {
        switch (logger) {
            case('http'):
                return this.logger.httpLogger.info(data)
            case('error'):
                return this.logger.errorLogger.error(data)
            default:
                return this.logger.defaultLogger.info(data)
        }
    }

}

abstract class Logger {
    abstract defaultLogger
    abstract httpLogger
    abstract errorLogger
}

class WinstonLogger extends Logger {
    defaultLogger;
    httpLogger;
    errorLogger;

    constructor(transports) {
        super();
        const defaultStringFormat = format.printf((info) => {
            const {label, status, stack, data, message, timestamp} = info
            const stack_ = stack || data?.stack
            return (`[${label}] - ${timestamp || ''} - ${status || ''} - ${message} : ${data ? JSON.stringify(data) + (stack_ ? "\n" + stack_ : "") : ''}`)
        });
        const defaultFileFormat = {}
        const defaultSettings = {
            level: "info",
            format: format.combine(format.label({label: "APP"}), format.timestamp(), defaultStringFormat),
            transports: transports
        }

        this.defaultLogger = createLogger(
            {...defaultSettings}
        )
        this.httpLogger = createLogger(
            {
                ...defaultSettings,
                format: format.combine(format.label({label: 'HTTP'}), format.timestamp(), format.colorize(), defaultStringFormat)
            }
        )
        this.errorLogger = createLogger(
            {
                //later
                ...defaultSettings,
                format: format.combine(format.label({label: 'ERROR'}), format.errors({stack: true}), format.timestamp(), format.colorize(), defaultStringFormat)
            }
        )
    }
}
