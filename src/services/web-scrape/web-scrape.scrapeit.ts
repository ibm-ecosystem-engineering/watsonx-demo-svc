import ScrapeitSDK = require('@scrapeit-cloud/google-serp-api');

import {SearchResult, WebScrapeApi, WebScrapeParams} from "./web-scrape.api";

export class WebScrapeScrapeit implements WebScrapeApi {
    service: ScrapeitSDK;

    constructor(apikey: string) {
        this.service = new ScrapeitSDK(apikey)
    }

    scrape(params: WebScrapeParams): Promise<SearchResult[]> {
        return this.service.scrape(params)
            .then(response => response.newsResults);
    }
}