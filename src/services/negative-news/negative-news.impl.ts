import ScrapeitSDK = require('@scrapeit-cloud/google-serp-api');
import {IamTokenManager} from "ibm-cloud-sdk-core";
import dayjs from "dayjs";

import {NegativeNewsApi} from "./negative-news.api";
import {NegativeScreeningModel, PersonModel} from "../../models";
import PQueue from "../../utils/p-queue";
import {
    GenAiModel,
    GenerateFunction,
    GenerativeInputParameters,
    GenerativeResponse,
    getUrlContent,
    isValidUrl
} from "../../utils";
import {buildDataExtractionBackendConfig, DataExtractionBackendConfig} from "../data-extraction/data-extraction.impl";
import {SearchResult, webScrapeApi, WebScrapeApi} from "../web-scrape";

const queue = new PQueue({concurrency: 1});

const topicRiskScoreConfig = {
    "terrorism": 10,
    "drug trafficking": 10,
    "arms dealing": 10,
    "terrorism financing": 10,
    "stock manipulation": 9,
    "money laundering": 10,
    "financial crimes": 8,
    "regulatory penalty": 7,
    "bankruptcy": 9,
    "jail": 8,
    "arrest": 5,
    "lawsuits": 4,
    "warrant": 4,
    "imprisonment": 5,
    "legal proceedings": 4,
    "rape": 9,
    "crime": 9,
    "criminal": 7,
    "criminal proceedings": 7,
    "corruption": 8,
    "fraud": 8,
    "hate": 7,
    "sexual abuse": 7,
    "illegal activities": 4
};

interface ScrapeitResponse {
    searchInformation: {
        totalResults: string;
        timeTaken: number;
    }
    newsResults: SearchResult[];
    pagination: {
        next: string;
        current: number;
        pages: Array<{
            [index: string]: string
        }>;
    }
}

interface NegativeNewsConfig {
    numResults: number;
    apiKey: string;
}

let _config: NegativeNewsConfig;
const buildNegNewsConfig = (): NegativeNewsConfig => {
    if (_config) {
        return _config;
    }

    const tmp: NegativeNewsConfig = {
        numResults: 5,
        apiKey: process.env.SCRAPEIT_API_KEY
    }

    if (!tmp.apiKey) {
        throw new Error('SCRAPEIT_API_KEY not set!')
    }

    return _config = tmp;
}


interface ValidatedSearchResult extends SearchResult {
    isValid: boolean;
    content?: string | Buffer;
}

interface ScoredSearchResult extends ValidatedSearchResult {
    negativeNewsTopics?: string[];
    hasNegativeNews?: boolean;
}

interface SummarizedSearchResult extends ScoredSearchResult {
    summary: string;
}

interface SearchResultMentions {
    subject: boolean;
    location?: boolean;
    dateOfBirth?: boolean;
    subjectAndAge?: boolean;
}
interface FilteredSearchResult extends SummarizedSearchResult {
    mentions: SearchResultMentions
}

export class NegativeNewsImpl implements NegativeNewsApi {
    backendConfig: DataExtractionBackendConfig;

    constructor(private readonly service: WebScrapeApi = webScrapeApi()) {
        this.backendConfig = buildDataExtractionBackendConfig();
    }

    buildClassifyGenerateFunction(genAiModel: GenAiModel): GenerateFunction {

        const parameters: GenerativeInputParameters = {
            decoding_method: 'greedy',
            max_new_tokens: 5,
            repetition_penalty: 2
        }

        return genAiModel.generateFunction({
            modelId: 'google/flan-ul2',
            parameters
        })
    }

    buildSummarizeGenerateFunction(genAiModel: GenAiModel): GenerateFunction {
        const parameters: GenerativeInputParameters = {
            decoding_method: "greedy",
            repetition_penalty: 2,
            min_new_tokens: 80,
            max_new_tokens: 200
        }

        return genAiModel.generateFunction({
            parameters,
            modelId: 'google/flan-ul2'
        })
    }

    async screenPerson(person: PersonModel): Promise<NegativeScreeningModel> {

        try {
            const {genAiModel} = await this.getBackend();

            const data: SearchResult[] = await this.search(person.name);

            const {validUrls, badUrls} = await this.validateUrls(data);

            // await this.reportBadUrls(badUrls);
            //
            const classify: GenerateFunction = this.buildClassifyGenerateFunction(genAiModel);
            const summarize: GenerateFunction = this.buildSummarizeGenerateFunction(genAiModel);

            const {negativeNews, positiveNews} = await this.checkAllNegativeNews(validUrls, classify);

            const summarizedPositiveNews = await this.summarizeAllNews(positiveNews, summarize);
            const summarizedNegativeNews = await this.summarizeAllNews(negativeNews, summarize);

            const {tp, fp} = await this.filterAllNews(summarizedNegativeNews, person.name, classify, person)

            const totalScreened = data.length;
            const result = this.finalConclusion(badUrls, tp, fp, summarizedPositiveNews, person.name, totalScreened)

            return result;
        } catch (err) {
            return {
                subject: person.name,
                summary: 'N/A',
                totalScreened: 0,
                negativeNews: [],
                negativeNewsCount: 0,
                nonNegativeNews: [],
                nonNegativeNewsCount: 0,
                unrelatedNews: [],
                unrelatedNewsCount: 0,
                error: err.message,
            }
        }
    }

    async getBackend(): Promise<{genAiModel: GenAiModel}> {

        const accessToken = await new IamTokenManager({
            apikey: this.backendConfig.wmlApiKey,
            url: this.backendConfig.identityUrl,
        }).getToken()

        const genAiModel: GenAiModel = new GenAiModel({
            accessToken,
            endpoint: this.backendConfig.wmlUrl,
            projectId: this.backendConfig.wmlProjectId,
        })

        return {
            genAiModel
        }
    }

    async search(query: string): Promise<SearchResult[]> {
        const negNewsConfig = buildNegNewsConfig();

        const params = {
            "q": query,
            "gl": "us",
            "hl": "en",
            "num": negNewsConfig.numResults,
            "tbm": "nws",
        }

        return queue
            .add(() => this.service.scrape(params))
            .catch(err => {
                console.log('Error accessing Scrapeit: ', {err})
                throw err
            }) as Promise<SearchResult[]>
    }

    async validateUrls(data: SearchResult[]): Promise<{validUrls: ValidatedSearchResult[], badUrls: ValidatedSearchResult[]}> {
        if (!data) {
            const message: string = 'validateUrls() data value is undefined'
            console.log(message)
            throw new Error(message)
        }

        const validatedData: ValidatedSearchResult[] = await Promise.all(
            data.map(this.validateUrl.bind(this))
        )

        return {
            validUrls: validatedData.filter(val => val.isValid),
            badUrls: validatedData.filter(val => !val.isValid),
        }
    }

    async validateUrl<T extends {link: string}, R extends T & {isValid: boolean, content?: string}>(data: T): Promise<R> {
        const result: {isValid: boolean, content?: string | Buffer} = await isValidUrl(data.link)

        return Object.assign({}, data, result) as any
    }

    async reportBadUrls(badUrls: ValidatedSearchResult[]) {
        console.log('Bad urls: ', badUrls);
    }

    async checkAllNegativeNews(news: ValidatedSearchResult[], generate: GenerateFunction): Promise<{negativeNews: ScoredSearchResult[], positiveNews: ScoredSearchResult[]}> {

        if (!news) {
            const message: string = 'checkAllNegativeNews() news value is undefined'
            console.log(message)
            throw new Error(message)
        }

        const results: ScoredSearchResult[] = await Promise.all(news.map(val => this.checkNegativeNews(val, generate)))

        return {
            negativeNews: results.filter(result => result.hasNegativeNews),
            positiveNews: results.filter(result => !result.hasNegativeNews)
        }
    }

    async checkNegativeNews(news: ValidatedSearchResult, generate: (input: string) => Promise<GenerativeResponse>): Promise<ScoredSearchResult> {
        const topics = Object.keys(topicRiskScoreConfig);
        const topicList = topics.join(', ');

        const content: string | Buffer = await getUrlContent(news.link, news.content);

        const negativeNewsPrompt = `From the context provided identify if there is any negative news or news related to ${topicList}, etc present or not. Provide a truthful answer in yes or no : ${content.toString()}`;

        const {generatedText: negativeNewsResult} = await generate(negativeNewsPrompt);

        if (negativeNewsResult === 'yes') {
            const negativeNewsTopics = (await Promise.all(
                topics.map(async (topic) => {
                    const topicPrompt = `From the context provided about news item can you suggest this news related to ${topic} or not. Provide a truthful answer in yes or no : ${content.toString()}`

                    const {generatedText: topicResult} = await generate(topicPrompt);

                    if (topicResult === 'yes') {
                        return topic;
                    } else {
                        return undefined;
                    }
                })))
                .filter(topic => !!topic)

            return Object.assign({}, news, {negativeNewsTopics, hasNegativeNews: true})
        } else {
            return news;
        }
    }

    async summarizeAllNews(news: ScoredSearchResult[], generate: GenerateFunction): Promise<SummarizedSearchResult[]> {

        if (!news) {
            const message: string = 'summarizeAllNews() news value is undefined'
            console.log(message)
            throw new Error(message)
        }

        return Promise.all(news.map(news => this.summarizeNews(news, generate)))
    }

    async summarizeNews(news: ScoredSearchResult, generate: GenerateFunction): Promise<SummarizedSearchResult> {
        const content: string | Buffer = await getUrlContent(news.link, news.content);

        const prompt = `Summarize the text in 2 or 3 sentences : ${content}`;

        const {generatedText: summary} = await generate(prompt);

        return Object.assign({}, news, {summary});
    }

    async filterAllNews(negativeNews: SummarizedSearchResult[], subjectName: string, generate: GenerateFunction, filterParams?: {countryOfResidence?: string, dateOfBirth?: string}): Promise<{tp: FilteredSearchResult[], fp: FilteredSearchResult[]}> {

        if (!negativeNews) {
            const message: string = 'filterAllNews() negativeNews value is undefined'
            console.log(message)
            throw new Error(message)
        }

        const result = await Promise.all(
            negativeNews.map(news => this.filterNews(news, subjectName, generate, filterParams))
        )

        return {
            tp: result.filter(val => (val.mentions.subject === true && val.mentions.location !== false && val.mentions.dateOfBirth !== false && val.mentions.subjectAndAge !== false)),
            fp: result.filter(val => val.mentions.subject === false || val.mentions.location === false || val.mentions.dateOfBirth === false || val.mentions.subjectAndAge === false)
        }
    }

    async filterNews(news: SummarizedSearchResult, subjectName: string, generate: GenerateFunction, filterParams?: {countryOfResidence?: string, dateOfBirth?: string}): Promise<FilteredSearchResult> {

        const content: string | Buffer = await getUrlContent(news.link, news.content)

        const subjectPrompt = `From the news text provided identify if the person ${subjectName} is mentioned anywhere in the text. Provide a truthful answer in yes or no. If not sure then say not sure : ${content}`

        const {generatedText: subjectResponse} = await generate(subjectPrompt);

        const mentions: SearchResultMentions = {
            subject: (subjectResponse === 'yes')
        }

        if (filterParams) {
            if (filterParams.countryOfResidence) {
                const countryPrompt = `From the news text provided identify if there is any mention of ${filterParams.countryOfResidence} anywhere in the text. Provide a truthful answer in yes or no. If not sure then say not sure : ${content}`

                const {generatedText: countryResponse} = await generate(countryPrompt);

                mentions.location = countryResponse === 'yes';
            }

            if (filterParams.dateOfBirth) {
                const dateOfBirthPrompt = `From the news text provided identify if there is any mention of ${filterParams.dateOfBirth} anywhere in the text. Provide a truthful answer in yes or no. If not sure then say not sure : ${content}`

                const {generatedText: dobResponse} = await generate(dateOfBirthPrompt);

                mentions.dateOfBirth = dobResponse === 'yes';
            }

            if (filterParams.dateOfBirth) {
                const today = dayjs()
                const dob = dayjs(filterParams.dateOfBirth)

                const ageYrs = today
                    .subtract(dob.get('month'), 'month')
                    .subtract(dob.get('day'), 'day')
                    .subtract(dob.get('year'), 'year')
                    .get('years')

                const agePrompt = `From the news text provided identify if the age of ${subjectName} is nearly around ${ageYrs} years or so. Provide a truthful answer in yes or no. If not sure then say not sure : ${content}`

                const {generatedText: ageResponse} = await generate(agePrompt);

                mentions.dateOfBirth = ageResponse === 'yes';
            }
        }

        return Object.assign({}, news, {mentions})
    }

    async finalConclusion(badUrls: ValidatedSearchResult[], negativeNews: FilteredSearchResult[], unrelatedNews: FilteredSearchResult[], nonNegativeNews: SummarizedSearchResult[], subject: string, totalScreened: number): Promise<NegativeScreeningModel> {

        const conclusion: string[] = []

        conclusion.push(`Total News Screened: ${totalScreened}  Neg-news: ${negativeNews.length}  Un-related news: ${unrelatedNews.length}  Non-neg news: ${nonNegativeNews.length}  Bad url: ${badUrls.length}`)

        const tpTopics = this.extractTopics(negativeNews)
        const fpTopics = this.extractTopics(unrelatedNews)

        const conclusionTextTpTopic = tpTopics.length > 0
            ? `Screening process has found ${negativeNews.length} negative news. Topics identified are - ${tpTopics.join(', ')}.`
            : ''
        conclusion.push(conclusionTextTpTopic)

        const conclusionTextFpTopic = fpTopics.length > 0
            ? `Screening process has found ${unrelatedNews.length} unrelated news. Topics identified are - ${fpTopics.join(', ')}.`
            : ''
        conclusion.push(conclusionTextFpTopic)

        if (negativeNews.length > 0) {
            conclusion.push(`The screening process has found that there are Negative News present about ${subject}. Initiate L2 level Screening.`)
        } else if (unrelatedNews.length > 0) {
            conclusion.push(`Even if the screening process has found that there are Negative News present but those seems not related to ${subject}. Further Manual Screening is recommended.`)
        } else {
            conclusion.push(`There are No Negative News found about ${subject}.`)
        }

        const result: NegativeScreeningModel = {
            negativeNews,
            negativeNewsCount: negativeNews.length,
            nonNegativeNews,
            nonNegativeNewsCount: nonNegativeNews.length,
            subject,
            summary: conclusion.join('\n'),
            totalScreened,
            unrelatedNews,
            unrelatedNewsCount: unrelatedNews.length,
        };

        return result;
    }

    extractTopics(vals: FilteredSearchResult[]) {
        if (!vals) {
            const message: string = 'extractTopics() vals parameter is undefined'
            console.log(message)
            throw new Error(message)
        }

        return vals
            .map(val => val.negativeNewsTopics)
            .reduce((topics: string[], current: string[]) => {
                const newTopics = current.filter(val => !topics.includes(val));

                return topics.concat(...newTopics);
            }, [])
    }
}