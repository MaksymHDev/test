import {RestrictionService} from "../restrictions/restriction.service";
import {getRandomIntId, getRandomText, prepareDb} from "../../tests/util";
import {User} from "../user/user.entity";
import {Restriction} from "./restriction.entity";

const generateRestr = (() => {
    let type;
    const def = getRandomIntId(100)
    if (def % 3 == 0) {
        type = null
    } else if (def % 2 == 0) {
        type = 'BLOCK'
    } else {
        type = 'BAN'
    }

    return {
        type: type,
        timeout: getRandomIntId(1000000, 10000),
        setAt: Date.now()
    }
})

const collectionSize = Number(process.env.COLLECTION_SIZE) || 1000

describe('RestrictionService', () => {
    describe(`For ${collectionSize} Entities`, () => {
        let service;
        let users;

        beforeAll(async () => {
            const {
                returnService, referenceData
            } = await prepareDb({
                target: [RestrictionService],
                repos: [User, Restriction]
            }, async (repos, service: RestrictionService, entityCount = {users: 1000}) => {
                let users = []
                const repo = repos.UserRepo

                for (let i = 0; i < entityCount.users; i++) {
                    users.push({
                        name: getRandomText(),
                        email: getRandomText(),
                        password: getRandomText()
                    })
                }
                for (const user of users) {
                    await repos.UserRepo.save(user)
                }
                users = await repos.UserRepo.find({})
                for (let i = 0; i < entityCount.users; i++) {
                    await service.declare(users[i].id, generateRestr())
                }
                users = await repos.UserRepo.find({relations: {restriction: true}})
                return users
            })

            service = returnService
            users = referenceData
        });

        it('should be defined', async () => {
            expect(service).toBeDefined();
        });

        it('should return Restriction Object with consistent structure', async () => {
            const id = users[getRandomIntId(collectionSize)].id
            const restr = await service.check(id)

            expect(restr).toHaveProperty('type')
            expect(restr).toHaveProperty('timeout')
            expect(restr).toHaveProperty('setAt')
        });

        it('should update and delete a Restriction if passed an empty "restriction" param', async () => {
            const id = users[getRandomIntId(collectionSize)].id
            const restr = await service.declare(id)
            const check = await service.check(id)

            expect(check).toHaveProperty('type', null)
        });

        it('should update a Restriction otherwise', async () => {
            const id = users[getRandomIntId(collectionSize)].id
            const gen = generateRestr()
            const restr = await service.declare(id, gen)
            const check = await service.check(id)

            expect(check).toHaveProperty('type', gen.type)
        })
    })
})
