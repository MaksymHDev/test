import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRandomText, getRandomIntId, prepareDb } from "../../tests/util";
import { SecretService } from "../../util/secret/secret.service";
import { SecretModule } from "../../util/secret/secret.module";
import { UserModule } from "../user/user.module";
import { RestrictionService } from "../restrictions/restriction.service";
import { User } from "../user/user.entity";
import { Restriction } from "../restrictions/restriction.entity";
import { UserService } from "../user/user.service";

const collectionSize = Number(process.env.COLLECTION_SIZE) || 1000

describe('AuthService', () => {
    describe(`For ${collectionSize} Entities`, () => {
        let service;
        beforeAll(async () => {
            const { returnService } = await prepareDb({
                target: [AuthService, UserService, SecretService],
                repos: [User]
            }, async (repos, service: AuthService, entityCount = {users: 1000}) => {
            })
            service = returnService['AuthService']
        })

        it('should be defined', () => {
            expect(service).toBeDefined();
        });
    })
});
