import Axios, {AxiosInstance} from 'axios';
import PQueue from "./p-queue";
import {delay} from "./delay";

const queue = new PQueue({concurrency: 2});

export interface GenerativeInputParameters {
    decoding_method: string;
    min_new_tokens?: number;
    max_new_tokens: number;
    repetition_penalty: number;
}

export interface GenerativeInput {
    modelId: string;
    input: string;
    projectId?: string;
    parameters: GenerativeInputParameters;
}

export interface GenerativeResponse {
    generatedText: string;
}

export interface GenerativeConfig {
    accessToken: string;
    projectId?: string;
    endpoint: string;
}

interface GenerativeBackendResponse {
    model_id: string;
    created_at: string;
    results: GenerativeBackendResponseResult[];
}

interface GenerativeBackendResponseResult {
    generated_text: string;
    generated_token_count: number;
    input_token_count: number;
    stop_reason: string;
}

export type GenerateFunction = (input: string) => Promise<GenerativeResponse>;

export class GenAiModel {
    private readonly client: AxiosInstance;
    private readonly projectId?: string;
    private readonly url: string;

    constructor(config: GenerativeConfig) {
        this.client = Axios.create({
            baseURL: config.endpoint,
            headers: {
                Authorization: `Bearer ${config.accessToken}`,
                "Content-Type": 'application/json',
                Accept: 'application/json',
            },
        })

        this.projectId = config.projectId;
        this.url = config.endpoint;
    }

    generateFunction(config: Omit<GenerativeInput, 'input'>): GenerateFunction {
        return (input: string) => this.generate(Object.assign({}, config, {input}))
    }

    async generate(input: GenerativeInput): Promise<GenerativeResponse> {
        return queue.add(() => this.generateInternal(input)) as any;
    }

    private async generateInternal(params: GenerativeInput, retryCount: number = 0): Promise<GenerativeResponse> {
        const input = params.input.slice(0, Math.min(4096, params.input.length))

        return this.client
            .post<GenerativeBackendResponse>(this.url, {
                model_id: params.modelId,
                input,
                parameters: params.parameters,
                project_id: params.projectId || this.projectId,
            })
            .then(result => {
                return {generatedText: result.data.results[0].generated_text};
            })
            .catch(err => {
                const status = err.response?.status;
                if (status == 429 && retryCount < 4) {
                    console.log('Too many requests!!! Retrying: ' + (retryCount + 1))
                    return delay(1000 * Math.random(), () => this.generateInternal(params, retryCount + 1))
                }

                console.log('Error generating text: ', err);
                throw err;
            })
    }
}