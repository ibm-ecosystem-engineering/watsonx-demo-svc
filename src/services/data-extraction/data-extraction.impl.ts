import * as process from "process";
import {IamAuthenticator, IamTokenManager} from "ibm-cloud-sdk-core";
import DiscoveryV2 = require("ibm-watson/discovery/v2");
const striptags = require("striptags");
import axios from "axios";

import {DataExtractionApi} from "./data-extraction.api";

import {createDiscoveryV2} from "../../utils/discovery-v2";
import {DataExtractionConfig, DataExtractionCsv} from "./data-extraction.csv";
import {kycCaseSummaryApi, KycCaseSummaryApi} from "../kyc-case-summary";
import {DataExtractionResultModel} from "../../models";
import {first, GenAiModel, GenerativeResponse} from "../../utils";
import PQueue from "../../utils/p-queue";

const concurrency = parseInt(process.env.FIND_PASSAGE_CONCURRENCY || '8')
const queue = new PQueue({concurrency});

export interface DataExtractionBackendConfig {
    identityUrl: string;
    wmlUrl: string;
    wmlApiKey: string;
    modelId: string;
    wmlProjectId: string;
    decodingMethod: string;
    maxNewTokens: number;
    repetitionPenalty: number;

    discoveryUrl: string;
    discoveryApiKey: string;
    discoveryVersion: string;
    discoveryProjectId: string;
    documentCount: number;

    kycProjectId: string;
    kycCollectionId: string;
    dataExtractionCollectionId: string;
}

export const buildDataExtractionBackendConfig = (): DataExtractionBackendConfig => {
    const config: DataExtractionBackendConfig = {
        identityUrl: process.env.IAM_URL || 'https://iam.cloud.ibm.com/identity/token',

        wmlUrl: process.env.WML_URL || 'https://us-south.ml.cloud.ibm.com/ml/v1-beta/generation/text?version=2023-05-28',
        wmlApiKey: process.env.WML_API_KEY,
        //modelId: process.env.MODEL_ID || 'google/flan-ul2',
        modelId: process.env.MODEL_ID || "google/flan-t5-xxl",
        wmlProjectId: process.env.WML_PROJECT_ID || '05ba9d92-734e-4b34-a672-f727a2c26440',

        decodingMethod: process.env.DECODING_METHOD || 'greedy',
        maxNewTokens: parseInt(process.env.MAX_NEW_TOKENS || '20'),
        repetitionPenalty: parseInt(process.env.REPETITION_PENALTY || '1'),

        discoveryUrl: process.env.DISCOVERY_URL || 'https://api.us-south.discovery.watson.cloud.ibm.com/instances/0992769e-726a-4ab0-a9d9-4352e204cc87',
        discoveryApiKey: process.env.DISCOVERY_API_KEY,
        discoveryVersion: process.env.DISCOVERY_VERSION || '2020-08-30',
        discoveryProjectId: process.env.DISCOVERY_PROJECT_ID || '303aab25-cb4f-4b28-b8d2-30e23e39a37f',
        documentCount: parseInt(process.env.DOCUMENT_COUNT || '5'),

        kycProjectId: process.env.KYC_PROJECT_ID || '303aab25-cb4f-4b28-b8d2-30e23e39a37f',
        kycCollectionId: process.env.KYC_COLLECTION_ID,
        dataExtractionCollectionId: process.env.DATA_EXTRACTION_COLLECTION_ID || 'd2042924-7671-d0f5-0000-018a41a20ec1',
    }

    if (!config.wmlApiKey) {
        throw new Error('WML_API_KEY environment variable not provided');
    }

    if (!config.discoveryApiKey) {
        throw new Error('DISCOVERY_API_KEY environment variable not provided');
    }

    return config;
}

export interface WatsonBackends {
    discovery: DiscoveryV2;
    wml: GenAiModel;
}

interface Context {
    texts: {[source: string]: string}
}

const SOURCE_KYCSUMMARY = 'KYCSummary'

export class DataExtractionImpl extends DataExtractionCsv<WatsonBackends, Context> implements DataExtractionApi {
    backendConfig: DataExtractionBackendConfig;

    constructor(private readonly kycSummaryService: KycCaseSummaryApi = kycCaseSummaryApi()) {
        super();

        this.backendConfig = buildDataExtractionBackendConfig();
    }

    async extractDataForQuestionInternal(customer: string, question: {id: string}, backends: WatsonBackends, context: Context): Promise<DataExtractionResultModel> {
        const config = first((await this.getCsvData()).filter(val => val.id === question.id))

        if (!config) {
            throw new Error('Unable to find question: ' + question.id)
        }

        console.log('Extracting data for question', {question: config.question, source: config.source, customer})

        const text = this.getTextFromContext(context, config.source) || await this.queryDiscovery(customer, config, backends);

        if (!text) {
            return {
                id: config.id,
                question: config.question,
                inScope: config.inScope,
                expectedResponse: config.expectedResponse,
                source: config.source,
                model: config.model,
                tokens: config.tokens,
                watsonxResponse: 'No content available. Please upload documents!',
                prompt: '',
            }
        }

        const {watsonxResponse, prompt} = await this.generateResponse(customer, config, text, backends);

        return {
            id: config.id,
            question: config.question,
            inScope: config.inScope,
            expectedResponse: config.expectedResponse,
            source: config.source,
            model: config.model,
            tokens: config.tokens,
            watsonxResponse,
            prompt,
        }
    }

    getTextFromContext(context: Context, source: string): string | undefined {
        const text = context.texts[source];

        if (text) {
            console.log('1. Text retrieved from context:', {source, text})
        }

        return text;
    }

    async queryDiscovery(customer: string, config: DataExtractionConfig, backends: WatsonBackends): Promise<string> {
        const naturalLanguageQuery = config.question + ' ' + customer;

        const passagesPerDocument = true;
        const response: DiscoveryV2.Response<DiscoveryV2.QueryResponse> = await backends.discovery.query({
            projectId: this.backendConfig.discoveryProjectId,
            naturalLanguageQuery,
            count: this.backendConfig.documentCount,
            // filter: `enriched_text.entities.type:Organization,enriched_text.entities.text:${customer}`,
            passages: {
                enabled: true,
                per_document: passagesPerDocument,
                count: 4
            }
        })

        const passages: string[] = !passagesPerDocument
            ? this.handleDiscoveryPassages(response.result)
            : this.handleDiscoveryResult(response.result, customer);

        console.log('Finding relevant passages')

        const text: string = await this.findRelevantPassages(naturalLanguageQuery, passages)

        console.log('1. Text extracted from Discovery:', {naturalLanguageQuery, text})

        console.log(text)

        return text;
    }

    filterDocuments(result: DiscoveryV2.QueryResponse, subject: string): DiscoveryV2.QueryResult[] {
        return result.results.filter(val => {
            const organizations = extractEntities(val.enriched_text, 'Organization')

            return organizations.map(v => v.toLowerCase()).includes(subject.toLowerCase())
        })
    }

    handleDiscoveryResult(result: DiscoveryV2.QueryResponse, customer: string): string[] {
        return this.filterDocuments(result, customer)
            .map(result => result.document_passages
                .map(passage => passage.passage_text)
            )
            .reduce((result: string[], current: string[]) => {
                return result.concat(...current)
            }, [])
    }

    handleDiscoveryPassages(result: DiscoveryV2.QueryResponse): string[] {
        return result.passages
            .map(passage => passage.passage_text)
    }

    async findRelevantPassages(question: string, passages: string[]): Promise<string> {
        const url = process.env.RELEVANT_PASSAGES_URL || 'https://similarity-check.18xu6cedovu0.us-south.codeengine.appdomain.cloud/api/find_relevant_passage'

        return await queue
            .add(async () => {
                console.log('Getting relevant passage')

                const relevantPassage = await axios
                        .post<{relevant_passage: string} | string>(url, {question, passages})
                        .then(response => {
                            if (typeof response.data === 'string') {
                                throw new Error('Error retrieving data')
                            }

                            return response.data.relevant_passage
                        })
                        .catch(err => {
                            console.error('Error getting relevant passages: ', {err})

                            return striptags(passages.join('\n'))
                        })

                console.log('Found relevant passage: ', {relevantPassage})

                return relevantPassage
            }) as string
    }

    async generateResponse(customer: string, config: DataExtractionConfig, text: string, backends: WatsonBackends): Promise<{watsonxResponse: string, prompt: string}> {

        const prompt = (config.prompt || `From below text find answer for ${config.question} ${customer}`).replace('#', customer);
        const max_new_tokens = config.tokens || this.backendConfig.maxNewTokens;

        const parameters = {
            decoding_method: this.backendConfig.decodingMethod,
            max_new_tokens,
            repetition_penalty: this.backendConfig.repetitionPenalty,
        }

        const input = prompt + '\n\n' + text;

        const modelId = config.model || this.backendConfig.modelId;
        const result: GenerativeResponse = await backends.wml.generate({
            input,
            modelId,
            parameters,
        });

        console.log('2. Text generated from watsonx.ai:', {prompt, modelId, max_new_tokens, generatedText: result.generatedText.trim(), input})

        return {watsonxResponse: result.generatedText.trim(), prompt: input};
    }

    async getBackends(): Promise<WatsonBackends> {

        const accessToken = await new IamTokenManager({
            apikey: this.backendConfig.wmlApiKey,
            url: this.backendConfig.identityUrl,
        }).getToken()

        const wml: GenAiModel = new GenAiModel({
            accessToken,
            endpoint: this.backendConfig.wmlUrl,
            projectId: this.backendConfig.wmlProjectId,
        })

        const discovery = await createDiscoveryV2({
            authenticator: new IamAuthenticator({
                apikey: this.backendConfig.discoveryApiKey,
            }),
            serviceUrl: this.backendConfig.discoveryUrl,
            version: this.backendConfig.discoveryVersion,
        })

        return {
            wml,
            discovery,
        }
    }

    async getContext(auth: WatsonBackends, subject: string, questions: Array<{id: string}>): Promise<Context> {
        const ids: string[] = questions.map(val => val.id)

        const sources = (await this.getCsvData())
            .filter(val => ids.includes(val.id))
            .map(val => val.source)

        if (!sources.includes(SOURCE_KYCSUMMARY)) {
            return {texts: {}}
        }

        const texts: {[source: string]: string} = {}
        texts[SOURCE_KYCSUMMARY] = await this.kycSummaryService
            .summarize(subject)
            .then(text => text.replace(/^Output: */, ''))
            .then(text => {
                console.log(`KYC Summary for ${subject}: ${text}`)

                return text
            })
            .catch(err => {
                console.log('Error getting kyc summary: ', {err})

                return undefined
            })

        return {texts}
    }


}

interface Entity {
    model_name: string
    text: string
    type: string
}

interface EnrichedText {
    entities: Entity[]
}

const extractEntities = (enrichedText: EnrichedText[], ...types: string[]): string[] => {
    return enrichedText
        .reduce((result: Entity[], current: EnrichedText) => {
            return result.concat(...current.entities)
        }, [])
        .filter((entity: Entity) => types.includes(entity.type))
        .map((entity: Entity) => entity.text)
}