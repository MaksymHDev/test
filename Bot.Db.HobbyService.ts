import { ArrayContains, DataSource, In, Repository } from "typeorm"
import { dataSource } from "../connectors/db.js"
import { HobbySchema } from "../schema/hobby.schema.js"
import { ReviewSchema } from "../schema/review.schema.js"
import { CategorySchema } from "../schema/category.schema.js"

export class HobbyService {
    repo: Repository<HobbySchema>

    constructor(dataSource: DataSource) {
        this.repo = dataSource.getRepository('Hobby')
    }

    async getRandom() {
        return this.repo.createQueryBuilder('hobby')
            .select('hobby._id')
            .orderBy('RANDOM()')
            .getMany()
    }

    async findById(id: HobbySchema['_id']): Promise<HobbySchema | null> {
        return this.repo.findOneBy({_id: id})
    }

    async findByName(name: string) {
        return this.repo.findOneBy({name: name})
    }

    async getByAttributes(attrs: Array<string>) {
        return this.repo.find({
            where: {
                attributes: {
                    name: In(attrs)
                }
            },
            relations: {attributes: true}
        })
    }

    async searchFilters(filters_: Array<string>) {
        const res = await this.repo.find({
            where: {
                filters: {
                    _id: In(filters_.map(filter=>parseInt(filter)))
                }
            },
            relations: {
                filters: true
            }
        })

        return res.filter(hobby => {
                for (const filter of filters_) {
                    if (!hobby.filters.find(flt => String(flt._id) === filter)) {
                        return false
                    }
                }
                return true
            }
        )
    }

    async searchCategory(category: number) {
        return this.repo.find({
            where: {
                category: {
                    _id: category
                }
            }, relations: {category: true}
        })
    }

    async leaveReview(id: HobbySchema["_id"], text: string) {
        const hobby = await this.repo.findOne({where: {_id: id}, relations: {reviews: true}})
        if (!hobby) {
            return
        }
        const review = new ReviewSchema()
        review.text = text
        hobby?.reviews.push(review)
        return await this.repo.save(hobby)
    }
}

export const hobbyService = new HobbyService(dataSource)
