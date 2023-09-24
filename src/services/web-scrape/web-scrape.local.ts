import {SearchResult, WebScrapeParams, WebScrapeWritableApi} from "./web-scrape.api";
import {join, resolve} from "path";
import {promises} from "fs";
import {first} from "../../utils";

type SearchResultCache = {[key: string]: SearchResult[]}

const filepath = join(
    resolve(__dirname),
    '../../../..',
    'config/news-cache.json'
)

let _cache: SearchResultCache;
const getCache = async (): Promise<SearchResultCache> => {
    if (_cache) {
        return _cache;
    }

    const fileContent = await promises.readFile(filepath)
        .catch(err => {
            console.log(`Error loading web scrape cache (${filepath})`, err)

            return '{}'
        })
        .then(buf => buf.toString())

    return JSON.parse(fileContent);
}

const writeCache = async (cache: SearchResultCache): Promise<void> => {
    return promises
        .writeFile(filepath, JSON.stringify(cache, null, ' '))
        .catch(err => {
            console.log(`Error saving web scrape cache (${filepath})`, err)

            return undefined
        });
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

        return cache[key];
    }

    async saveResults(params: WebScrapeParams, results: Promise<SearchResult[]>): Promise<SearchResult[]> {
        const key = params.q.toLowerCase();
        const cache = await getCache();

        cache[key] = await results;

        writeCache(cache)
            .catch(err => console.error('Error saving results: ', err));

        return results;
    }
}
