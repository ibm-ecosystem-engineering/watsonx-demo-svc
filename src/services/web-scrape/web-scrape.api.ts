
export interface WebScrapeParams {
    q: string;
    gl: string;
    hl: string;
    num: number;
    tbm: string;
}

export interface SearchResult {
    position: number;
    title: string;
    link: string;
    source: string;
    snippet: string;
    date: string;
}

export abstract class WebScrapeApi {
    abstract scrape(params: WebScrapeParams): Promise<SearchResult[]>;
}

export abstract class WebScrapeWritableApi extends WebScrapeApi {
    abstract saveResults(params: WebScrapeParams, results: Promise<SearchResult[]>): Promise<SearchResult[]>;
}
