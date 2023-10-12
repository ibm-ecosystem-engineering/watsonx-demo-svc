export interface DataExtractionQuestionModel {
    id: string;
    question: string;
    inScope: boolean;
}

export interface DataExtractionResultModel extends DataExtractionQuestionModel {
    source: string;
    model: string;
    tokens: number;
    prompt: string;
    expectedResponse: string;
    watsonxResponse: string;
}
