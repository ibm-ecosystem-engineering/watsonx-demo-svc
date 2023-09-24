export interface DataExtractionQuestionModel {
    id: string;
    question: string;
    inScope: boolean;
}

export interface DataExtractionResultModel extends DataExtractionQuestionModel {
    prompt: string;
    expectedResponse: string;
    watsonxResponse: string;
}
