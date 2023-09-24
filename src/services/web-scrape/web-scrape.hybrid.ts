import {SearchResult, WebScrapeApi, WebScrapeParams, WebScrapeWritableApi} from "./web-scrape.api";
import {WebScrapeScrapeit} from "./web-scrape.scrapeit";
import {WebScrapeLocal} from "./web-scrape.local";

export class WebScrapeHybrid implements WebScrapeApi {
    service: WebScrapeApi;
    cache: WebScrapeWritableApi;

    constructor(apikey: string) {
        this.service = new WebScrapeScrapeit(apikey);
        this.cache = new WebScrapeLocal();
    }

    async scrape(params: WebScrapeParams): Promise<SearchResult[]> {
        const result = await this.cache.scrape(params);

        if (result.length > 0) {
            console.log('Cache hit!!')
            return result;
        }

        return this.cache.saveResults(params, this.service.scrape(params));
    }

}