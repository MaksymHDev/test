import { HobbyService } from "../../services/hobby.service.js"
import { CategoryService } from "../../services/category.service.js"
import TelegramBot, { CallbackQuery } from "node-telegram-bot-api"
import TEXT from "../../static/bot-text/text-data.json" assert {type: 'json'}
import { InlineKeyboard, InlineKeyboardButton, Row } from "node-telegram-keyboard-wrapper"
import { Cache } from "../../Cache/CacheClient.js"
import { HobbySchema } from "../../schema/hobby.schema.js"
import { FiltersRepo } from "../../Cache/FilteredHobbies.Repo.js"
import { RandomHobbiesRepo } from "../../Cache/RandomHobbies.Repo.js"
import { HobbyChoiceRandom } from "../Rows/HobbyChoiceRandom.js"
import { CategoriesRow } from "../Rows/CategoriesRow.js"
import { HobbyRowGeneral } from "../Rows/HobbyRowGeneral.js"
import { FiltersRow } from "../Rows/FiltersRow.js"
import { HobbyChoice } from "../Rows/HobbyChoice.js"


export class HobbyViewCommandController {
    randomCache: RandomHobbiesRepo
    filtersCache: FiltersRepo
    hobbyService: HobbyService
    categoryService: CategoryService
    number_of_results: number
    bot: TelegramBot

    constructor(cache: Cache, hobbyService: HobbyService, categoryService: CategoryService, bot: TelegramBot) {
        this.hobbyService = hobbyService
        this.categoryService = categoryService
        this.filtersCache = cache.getRepository<FiltersRepo>('filters')
        this.randomCache = cache.getRepository<RandomHobbiesRepo>('random')
        this.number_of_results = 8
        this.bot = bot
    }

    async random(input: CallbackQuery) {
        const NUMBER = this.number_of_results
        const id = String(input.message?.chat.id)
        let got = await this.randomCache.get(id + 'hobbies', NUMBER)

        if (!got) {
            const hobbies = await this.hobbyService.getRandom()
            got = await this.randomCache.put(id + 'hobbies', hobbies, NUMBER)
        }

        const hobbies: Array<HobbySchema> = []
        await Promise.all(got.map(async (hobby_: string) => {
            const hobby = await this.hobbyService.findById(Number(hobby_))
            if (hobby) hobbies.push(hobby)
        }))

        await this.bot.sendMessage(Number(id), TEXT.random.none, {
            reply_markup: {
                ...new InlineKeyboard(
                    new Row(new InlineKeyboardButton(TEXT.random.once_more, 'callback_data', 'get-random')),
                    new Row(new InlineKeyboardButton(TEXT.general.go_back, 'callback_data', 'go-back'))).getMarkup(),
                resize_keyboard: true
            }
        })
        await this.bot.deleteMessage(Number(id), String(input?.message?.message_id))
    }

     async random_change(input: CallbackQuery) {
        const to_change = input.data.split(':')[1]
        const message = input.message
        const id = message.chat.id.toString()
        if (!id || !to_change) return

        const got = await this.randomCache.pop(id + 'hobbies', to_change)
        if (!got) await this.bot.sendMessage(id, TEXT.random.none)

        const hobby = await this.hobbyService.findById(Number(got))
        if (!hobby) return

        const text = `*${hobby.name}*\n${hobby.descr}`
        await this.bot.editMessageText(text, {
            message_id: Number(message?.message_id),
            chat_id: id,
            reply_markup: {
                ...new HobbyChoiceRandom().transform([hobby], {
                    row_len: 30,
                    mode: 'quiz',
                    in_a_row: 10,
                    page: 0,
                    final: false
                })
            },
            parse_mode: "Markdown"
        })
    }

    async propose_category(input: CallbackQuery) {
        const id = input.message.chat.id
        const message_id = input.message.message_id
        const data = input.data.split(':')[1]
        const page = data? parseInt(data) : 0

        const categories = await this.categoryService.getAll(false)
        if (!categories) return

        const skip = page * this.number_of_results
        const limit = skip + this.number_of_results
        let final = limit >= categories.length

        await this.bot.sendMessage(Number(id), TEXT.categories.request, {
            reply_markup: {
                ...new CategoriesRow().transform(categories.slice(skip, limit), {
                    row_len: 30,
                    mode: 'quiz',
                    in_a_row: 1,
                    page,
                    final
                }),
                resize_keyboard: true
            }
        })
        await this.bot.deleteMessage(Number(id), String(input.message?.message_id))
    }

     async get_by_category(input: CallbackQuery) {
        const id = input.message.chat.id
        const category = input.data.split(':')[1]
        const page = Number(input.data.split(':')[2]) || 0
        const hobbies = await this.hobbyService.searchCategory(Number(category))

        if (!hobbies.length) return

        const skip = page * this.number_of_results
        const limit = skip + this.number_of_results
        let final = limit >= hobbies.length
        await this.bot.sendMessage(Number(id), TEXT.categories.result,
            {
                reply_markup: {
                    ...new HobbyRowGeneral().transform(hobbies.slice(skip, limit), {
                        page,
                        final,
                        in_a_row: 10,
                        row_len: 30,
                        additional_data: category,
                        mode: 'category'
                    }),
                    resize_keyboard: true
                }
            })
        return this.bot.deleteMessage(Number(id), String(input.message?.message_id))
    }

     async propose_filters(input: CallbackQuery) {
        const id = input.message.chat.id
        const message_id = input.message.message_id
        const data = input.data.split(':')[1]
        const page: number | undefined = data ? parseInt(data) : 0

        const filters = await this.categoryService.getAll(true)

        const chosen = await this.filtersCache.get(id + 'filters')
        if (!filters) return

        const skip = page * this.number_of_results
        const limit = skip + this.number_of_results
        let final = limit >= filters.length
        const Buttons_ = new FiltersRow().transform(filters.slice(skip, limit), {
            page,
            final,
            in_a_row: 1,
            row_len: 30,
            additional_entities: chosen,
            mode: 'category'
        })

        if (page >= 1) {
            return this.bot.editMessageReplyMarkup(Buttons_, {
                message_id: message_id,
                chat_id: id,
            })
        }

        await this.bot.sendMessage(Number(id), TEXT.filters.get, {
            reply_markup: {...Buttons_, resize_keyboard: true}
        })

        return this.bot.deleteMessage(Number(id), String(message_id))
    }

     async set_filters(input: CallbackQuery) {
        const id = input.message.chat.id
        const filter_id = input.data.split(':')[1]
        const data = input.data.split(':')[2]
        const page: number | undefined = data? parseInt(data) : 0

        const filters_chosen = await this.filtersCache.put(id + 'filters', String(filter_id))

        const filters = await this.categoryService.getAll(true)
        if (!filters) return

        const skip = page * this.number_of_results
        const limit = skip + this.number_of_results
        let final = limit >= filters.length

        return this.bot.editMessageReplyMarkup(new FiltersRow().transform(filters.slice(skip, limit), {
            page,
            final,
            in_a_row: 1,
            row_len: 30,
            additional_entities: filters_chosen,
            mode: 'category'
        }), {
            message_id: input.message?.message_id,
            chat_id: id,
        })

    }

     async get_by_filters(input: CallbackQuery) {
        const id = input.message.chat.id
        const page = Number(input.data?.split(':')[2]) || 0

        const filters = await this.filtersCache.get(id + 'filters')
        const hobbies = await this.hobbyService.searchFilters(filters)
        if (hobbies.length <= 0)
            return this.bot.sendMessage(Number(id), TEXT.filters.none)

        const skip = page * this.number_of_results
        const limit = skip + this.number_of_results
        let final = limit >= hobbies.length

        await this.filtersCache.purge(id + 'filters')
        await this.bot.sendMessage(Number(id), TEXT.categories.result,
            {
                reply_markup: {
                    ...new HobbyRowGeneral().transform(hobbies.slice(skip, limit), {
                        page,
                        final,
                        in_a_row: 1,
                        row_len: 30,
                        mode: 'filter'
                    }),
                    resize_keyboard: true
                }
            })
        await this.bot.deleteMessage(Number(id), String(input.message?.message_id))
    }

     async view(input: CallbackQuery) {
        const id = input.message.chat.id
        const hobby_id = input.data.split(':')[1]

        const hobby = await this.hobbyService.findById(Number(hobby_id))
        if (!hobby) return

        const text = `*${hobby.name}* \n ${hobby.descr}`
        const markup = new HobbyChoiceRandom().transform([hobby], {
            page: 0,
            final: false,
            in_a_row: 10,
            row_len: 30,
            mode: 'filter'
        })

        await this.bot.sendMessage(Number(id), text, {
            reply_markup: {...markup, resize_keyboard: true},
            parse_mode: "Markdown"
        })
        await this.bot.deleteMessage(Number(id), String(input.message?.message_id))
    }
}
