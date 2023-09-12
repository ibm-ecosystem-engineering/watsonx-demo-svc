import * as process from "process";
import {IamAuthenticator, IamTokenManager} from "ibm-cloud-sdk-core";
import {Client} from '@ibm-generative-ai/node-sdk';

import {DataExtractionApi} from "./data-extraction.api";
import {DataExtractionConfig, DataExtractionCsv} from "./data-extraction.csv";
import {DataExtractionResultModel} from "../../models";
import {first, GenAiModel, GenerativeResponse} from "../../utils";
import DiscoveryV2 = require("ibm-watson/discovery/v2");

interface DataExtractionBackendConfig {
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
}

export const buildDataExtractionBackendConfig = (): DataExtractionBackendConfig => {
    const config: DataExtractionBackendConfig = {
        identityUrl: process.env.IAM_URL || 'https://iam.cloud.ibm.com/identity/token',

        wmlUrl: process.env.WML_URL || 'https://us-south.ml.cloud.ibm.com/ml/v1-beta/generation/text?version=2023-05-28',
        wmlApiKey: process.env.WML_API_KEY,
        modelId: process.env.MODEL_ID || 'google/flan-ul2',
        wmlProjectId: process.env.WML_PROJECT_ID || '05ba9d92-734e-4b34-a672-f727a2c26440',

        decodingMethod: process.env.DECODING_METHOD || 'greedy',
        maxNewTokens: parseInt(process.env.MAX_NEW_TOKENS || '20'),
        repetitionPenalty: parseInt(process.env.REPETITION_PENALTY || '1'),

        discoveryUrl: process.env.DISCOVERY_URL || 'https://api.us-south.discovery.watson.cloud.ibm.com/instances/0992769e-726a-4ab0-a9d9-4352e204cc87',
        discoveryApiKey: process.env.DISCOVERY_API_KEY,
        discoveryVersion: process.env.DISCOVERY_VERSION || '2020-08-30',
        discoveryProjectId: process.env.DISCOVERY_PROJECT_ID || '303aab25-cb4f-4b28-b8d2-30e23e39a37f',
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

export class DataExtractionImpl extends DataExtractionCsv<WatsonBackends> implements DataExtractionApi {
    backendConfig: DataExtractionBackendConfig;

    constructor() {
        super();

        this.backendConfig = buildDataExtractionBackendConfig();
    }

    async extractDataForQuestionInternal(customer: string, question: {id: string}, backends: WatsonBackends): Promise<DataExtractionResultModel> {
        const config = first((await this.getCsvData()).filter(val => val.id === question.id))

        if (!config) {
            throw new Error('Unable to find question: ' + question.id)
        }

        console.log('Extracting data for question', {question: config.question, customer})

        const text = await this.queryDiscovery(customer, config, backends);

        const watsonxResponse = await this.generateResponse(customer, config, text, backends);

        return {
            id: config.id,
            question: config.question,
            inScope: config.inScope,
            expectedResponse: config.expectedResponse,
            watsonxResponse,
        }
    }

    async queryDiscovery(customer: string, config: DataExtractionConfig, backends: WatsonBackends): Promise<string> {
        const naturalLanguageQuery = config.question + ' ' + customer;

        const passagesPerDocument = false;
        const response: DiscoveryV2.Response<DiscoveryV2.QueryResponse> = await backends.discovery.query({
            projectId: this.backendConfig.discoveryProjectId,
            naturalLanguageQuery,
            count: 3,
            passages: {
                enabled: true,
                per_document: passagesPerDocument,
                count: 3
            }
        })

        const text = !passagesPerDocument
            ? this.handleDiscoveryPassages(response.result)
            : this.handleDiscoveryResult(response.result);

        console.log('1. Text extracted from Discovery:', {naturalLanguageQuery, text})

        return text;
    }

    handleDiscoveryResult(result: DiscoveryV2.QueryResponse): string {
        return result.results
            .map(result => result.document_passages
                .map(passage => passage.passage_text)
                .join('\n')
            )
            .join('\n')
    }

    handleDiscoveryPassages(result: DiscoveryV2.QueryResponse): string {
        return result.passages
            .map(passage => passage.passage_text)
            .join('\n')
    }

    async generateResponse(customer: string, config: DataExtractionConfig, text: string, backends: WatsonBackends): Promise<string> {

        const prompt = (config.prompt || `From below text find answer for ${config.question} ${customer}`).replace('#', customer);
        // const prompt = (`From below text find answer for ${config.question} ${customer}`).replace('#', customer);
        const parameters = {
            decoding_method: this.backendConfig.decodingMethod,
            max_new_tokens: this.backendConfig.maxNewTokens,
            repetition_penalty: this.backendConfig.repetitionPenalty,
        }

        const input = prompt + '\n\n' + text;

        const result: GenerativeResponse = await backends.wml.generate({
            input,
            modelId: this.backendConfig.modelId,
            parameters,
        });

        console.log('2. Text generated from watsonx.ai:', {prompt, generatedText: result.generatedText, input})

        return result.generatedText;
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

        const discovery = new DiscoveryV2({
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

}
