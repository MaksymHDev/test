import { PsycheAttributes } from "../schema/user.psych.schema.js"
import { InlineKeyboard, InlineKeyboardButton, Row } from "node-telegram-keyboard-wrapper"
import TelegramBot, { CallbackQuery } from "node-telegram-bot-api"
import TEXT from "../static/bot-text/text-data.json" assert { type: 'json' }
import { userService, UserService } from "../services/user.service.js"
import { hobbyService, HobbyService } from "../services/hobby.service.js"
import { HobbySchema } from "../schema/hobby.schema.js"
import { Cache } from "../Cache/CacheClient.js"
import { HobbyRowGeneral } from "./Rows/HobbyRowGeneral.js"
import { cache } from "../Cache/module/index.js"

export class QuizManager {
    cache: Cache
    userService: UserService
    hobbyService: HobbyService
    number_of_results = 8
    questions: Array<QuizQuestion>

    constructor(cache: Cache, userService: UserService, hobbyService: HobbyService, questions?: Array<QuizQuestion>) {
        this.questions = questions || []
        this.cache = cache
        this.userService = userService
        this.hobbyService = hobbyService
    }

    add(...questions: Array<QuizQuestion>) {
        this.questions.push(...questions)
    }

     async start(bot: TelegramBot, input: CallbackQuery) {
        const id = input.message?.chat.id
        const { text, options } = this.questions[0].ask()
        await this.cache.set(String(id) + 'quiz', 1)
        await this.userService.resetPsyche(String(id))

        await bot.editMessageText(text, {
            chat_id: id,
            message_id: input.message?.message_id,
            ...options
        })
    }

    async proceed(bot: TelegramBot, input: CallbackQuery) {
        const id = input.message?.chat.id
        const data = input.data?.split(':')
        if (!data) return

        const [attr, val] = data.slice(1)
        const success = await this.userService.setPsyche(String(id), attr as PsycheAttributes, Number(val))
        if (!success) return

        const num = await this.cache.get(id + 'quiz')
        if (Number(num) < this.questions.length) {
            await this.cache.set(String(id) + 'quiz', Number(num) + 1)
            const { text, options } = this.questions[num].ask()

            await bot.editMessageText(text, {
                chat_id: id,
                message_id: input.message?.message_id,
                ...options
            })
            return
        }

        await this.cache.del(id)
        const attributes = await this.userService.getPsyche(String(id))
        if (!attributes) return

        const hobbies = await this.hobbyService.getByAttributes(attributes)
        await this.cache.set(String(id) + 'quiz_res', hobbies.map(hobby => hobby._id))

        await bot.editMessageText(TEXT.quiz.end, {
            chat_id: id,
            message_id: input.message?.message_id,
            reply_markup: new InlineKeyboard(
                new Row(new InlineKeyboardButton(TEXT.quiz.result, 'callback_data', 'show-quiz:0')),
                new Row(new InlineKeyboardButton(TEXT.general.go_back, 'callback_data', 'go-back'))).getMarkup()
        })
    }

    async results(bot: TelegramBot, input: CallbackQuery) {
        const id = input.message?.chat.id
        const page = Number(input.data?.split(':')[1])
        const got = await this.cache.get(String(id) + 'quiz_res')

        const hobbies: Array<HobbySchema> = []
        await Promise.all(got.map(async (hobby_: string) => {
            const hobby = await this.hobbyService.findById(Number(hobby_))
            if (hobby) hobbies.push(hobby)
        }))

        const skip = page * this.number_of_results
        const limit = skip + this.number_of_results
        let final = limit >= hobbies.length

        await bot.editMessageText(TEXT.categories.result, {
            chat_id: id,
            message_id: input.message?.message_id,
            reply_markup: new HobbyRowGeneral().transform(hobbies.slice(skip, limit), {
                row_len: 30,
                mode: 'quiz',
                in_a_row: 10,
                page,
                final
            })
        })
    }
}

export type OptionsT = Array<{ prompt: string, psych_attr: PsycheAttributes, value: number }>

export class QuizQuestion {
    prompt: string
    cb_action = 'set-psyche'
    options: unknown

    constructor(prompt: string, options: OptionsT) {
        this.prompt = prompt
        this.options = options
    }

    ask() {
        return {
            text: this.prompt, options: {
                reply_markup: new InlineKeyboard(...this.options.map((option) =>
                    new Row(new InlineKeyboardButton(option.prompt, 'callback_data', this.cb_action + ':' + option.psych_attr + ':' + option.value))
                )).getMarkup()
            }
        }
    }
}

export const quiz = new QuizManager(cache, userService, hobbyService)
