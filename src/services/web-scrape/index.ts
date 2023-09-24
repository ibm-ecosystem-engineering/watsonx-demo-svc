import {WebScrapeApi} from "./web-scrape.api";
import {WebScrapeHybrid} from "./web-scrape.hybrid";
import {WebScrapeLocal} from "./web-scrape.local";
import {Provider} from "@nestjs/common";
import {NegativeNewsApi} from "../negative-news";
import {NegativeNewsImpl} from "../negative-news/negative-news.impl";

export * from './web-scrape.api'

const apikey = process.env.SCRAPEIT_API_KEY

let _instance: WebScrapeApi;
export const webScrapeApi = () => {
    if (_instance) {
        return _instance;
    }

    return _instance = apikey ? new WebScrapeHybrid(apikey) : new WebScrapeLocal();
}

export const webScrapeProvider: Provider = {
    provide: WebScrapeApi,
    useFactory: webScrapeApi
};
