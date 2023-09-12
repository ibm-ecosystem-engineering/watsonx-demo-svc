import Axios, {AxiosInstance} from 'axios';
import PQueue from "./p-queue";

const queue = new PQueue({concurrency: 4});

export interface GenerativeInputParameters {
    decoding_method: string;
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

    async generate(input: GenerativeInput): Promise<GenerativeResponse> {
        return queue.add(() => this.generateInternal(input)) as any;
    }

    private async generateInternal(input: GenerativeInput): Promise<GenerativeResponse> {
        return this.client
            .post<GenerativeBackendResponse>(this.url, {
                model_id: input.modelId,
                input: input.input,
                parameters: input.parameters,
                project_id: input.projectId || this.projectId,
            })
            .then(result => {
                return {generatedText: result.data.results[0].generated_text};
            })
            .catch(err => {
                console.log('Error generating text: ', err);
                throw err;
            })
    }
}