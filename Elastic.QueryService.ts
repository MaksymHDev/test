import client from "./connect.elasticsearch.js";
import { SearchBy } from "./interfaces/SearchBy.js";

class ElasticSearchService {
    client

    constructor(elasticClient) {
        this.client = elasticClient
    }

    async bulk(data, index) {
        const client = this.client
        client.helpers.bulk(
            {
                datasource: data,
                onDocument(doc) {
                    return {
                        index: {
                            _index: index,
                        }
                    }
                },
                refreshOnCompletion: index
            }
        )
    }

    async get(index, search: SearchBy, sort, size: number) {
        const query = {}

        if (search.team) {
            query['should'] = {
                Team1_name: search.team,
                Team2_name: search.team
            }
        }

        if (search.event) {
            query['must']['E_name'] = search.event
        }

        if (search.date) {
            query['must']['date'] = search.date
        }

        const client = this.client

        return client.search({
            index: index,
            sort: [
                ...sort
            ],
            query: {
                bool: {
                    ...query
                },
            },
            size: size
        })
    }

    async getMeta() {
        const client = this.client
        const indices = await client.cat.indices()
        const health = await client.cat.health()
        return {  indices, health }
    }
}

export const SearchService = new ElasticSearchService(client)