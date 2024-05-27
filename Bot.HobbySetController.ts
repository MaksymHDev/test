import { HobbyService } from "../../services/hobby.service.js"
import { UserService } from "../../services/user.service.js"
import EventEmitter from "events"
import TEXT from "../../static/bot-text/text-data.json" assert { type:'json' }
import TelegramBot, { CallbackQuery, Message } from "node-telegram-bot-api"
import { schedulePing } from "../../util/schedule.js"
import { RateHobbyBtn } from "../Buttons/RateHobby.js"
import { PingOptions } from "../Rows/PingOptions.js"


export class HobbySetController {
    hobbyService: HobbyService
    userService: UserService
    number_of_results: number
    bot: TelegramBot

    constructor(hobbyService: HobbyService, userService: UserService, bot: TelegramBot) {
        this.hobbyService = hobbyService
        this.userService = userService
        this.bot = bot
        this.number_of_results = 8
    }

     async choose(input: CallbackQuery) {
        const id = input.message?.chat.id
        const hobby_id = input.data?.split(':')[1]
        const edit = input.data?.split(':')[2]

        const hobby = await this.hobbyService.findById(Number(hobby_id))
        if (!hobby) throw new Error('no hobby')

        const usr = await this.userService.setHobby(String(id), hobby)
        if (!usr) throw new Error('no user')

        const guide = await this.hobbyService.findById(Number(hobby_id))
        if (!guide) throw new Error('no guide')

        const text = `${hobby.name}\n${TEXT.ping.request}`

        await this.bot.sendMessage(
            Number(id), text, { reply_markup: new PingOptions().transform(['1', '3', '7'], hobby._id) }
        )
    }

     async setPing(input: CallbackQuery) {
        const id = input.message?.chat.id
        const ping_time = input.data?.split(':')[1]
        const hobby_id = input.data?.split(':')[2]
        const hobby_got = await this.hobbyService.findById(Number(hobby_id))
        if (!hobby_got) return

        const usr = await this.userService.get(String(id))
        if (!usr) return

        await schedulePing({days: Number(ping_time)}, {user: usr, hobby: hobby_got})
        await this.bot.editMessageText(TEXT.ping.confirm, {
            chat_id: id,
            message_id: Number(input.message?.message_id)
        })
    }

     async answerPing(input: CallbackQuery) {
        const id = input.message?.chat.id
        const tried = Number(input.data?.split(':')[1])
        const hobby = input.data?.split(':')[2]

        await this.bot.editMessageText(TEXT.ping.liked, {
            chat_id: Number(id),
            message_id: Number(input.message?.message_id),
            reply_markup: {
                inline_keyboard: [[new RateHobbyBtn(true)], [new RateHobbyBtn(false)]]
            }
        })
    }

    async rate(input: CallbackQuery) {
        const id = input.message?.chat.id
        const liked = Number(input.data?.split(':')[1])
        const user = await this.userService.get(String(id))
        if (!user) return

        const hobby_got = await this.hobbyService.findById(Number(user.current_Hobby._id))
        if (!hobby_got) return

        await this.bot.editMessageText(TEXT.ping.congratulate, {
            chat_id: id,
            message_id: input.message?.message_id
        })
        await schedulePing({
            days:
                Number({days: 30})
        }, {user: user, hobby: hobby_got})
    }

    async acceptRating(input: Message, events: EventEmitter) {
        const id = input.chat.id
        const review = input.text.split('/ratemy')[1].trim()
        const user = await this.userService.get(String(id))

        if (!user?.current_Hobby) {
            await this.bot.editMessageText(TEXT.rate.no_hobby, {
                chat_id: id,
                message_id: input.message_id
            })
        } else {
            await this.hobbyService.leaveReview(user.current_Hobby._id, review)
            await this.bot.sendMessage(Number(id), TEXT.rate.thank)
            events.emit('go-back', input)
        }
    }
}
