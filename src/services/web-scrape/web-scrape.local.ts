import {promises} from "fs";
import {join} from "path";
import {SearchResult, WebScrapeParams, WebScrapeWritableApi} from "./web-scrape.api";
import {first} from "../../utils";

type SearchResultCache = {[key: string]: SearchResult[]}

const savedContentFiles = {
    'bank alfalah': './scraped_news_bank_alfalah.json',
    'james alexander': './scraped_news_james_alexander.json',
    'mahinda rajapaksa': './scraped_news_mahinda_rajapaksa.json',
    'mehul choksi': './scraped_news_mehul_choksi.json',
    'michael jackson': './scraped_news_michael_jackson.json',
}

let _cache: SearchResultCache;
const getCache = async (): Promise<SearchResultCache> => {
    if (_cache) {
        return _cache;
    }

    const keys = Object.keys(savedContentFiles)

    const contents = await Promise.all(keys.map(key => promises.readFile(join(__dirname, savedContentFiles[key]))))

    return _cache = keys
        .map((key: string, index: number) => ({key, value: JSON.parse(contents[index].toString())}))
        .reduce((result: SearchResultCache, current: {key: string, value: any}) => {
            const val = {}

            val[current.key] = current.value

            return Object.assign(result, val)
        }, {})
}

export class WebScrapeLocal implements WebScrapeWritableApi {

    async scrape(params: WebScrapeParams): Promise<SearchResult[]> {
        const cache = await getCache();

        const key = first(Object
            .keys(cache)
            .filter(k => params.q.toLowerCase() === k))

        if (!key) {
            return []
        }

        console.log('Found stored data: ' + key)

        return cache[key];
    }

    async saveResults(params: WebScrapeParams, results: Promise<SearchResult[]>): Promise<SearchResult[]> {
        const key = params.q.toLowerCase();
        const cache = await getCache();

        cache[key] = await results;

        return results;
    }
}
