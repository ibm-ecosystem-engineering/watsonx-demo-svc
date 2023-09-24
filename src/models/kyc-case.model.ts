import * as Stream from "stream";

export interface KycCaseModel {
    id: string;
    status: string;
    customer: CustomerModel;
    documents: DocumentModel[];
    counterparty?: PersonModel;
    customerOutreach?: string;
    negativeScreening?: NegativeScreeningModel;
    counterpartyNegativeScreening?: NegativeScreeningModel;
    customerRiskAssessment?: CustomerRiskAssessmentModel;
    caseSummary?: KycCaseSummaryModel;
}

export interface PersonModel {
    name: string;
    countryOfResidence: string;
    dateOfBirth?: string;
}

export interface CustomerModel extends PersonModel {
    personalIdentificationNumber: string;
    industryType: string;
    entityType: string;
}

export interface DocumentModel extends DocumentInputModel {
    content: Buffer;
}

export interface NegativeScreeningModel {
    subject: string;
    totalScreened: number;
    negativeNewsCount: number;
    negativeNews: NewsItemModel[];
    nonNegativeNewsCount: number;
    nonNegativeNews: NewsItemModel[];
    unrelatedNewsCount: number;
    unrelatedNews: NewsItemModel[];
    summary: string;
    error?: string;
}

export interface NewsItemModel {
    title: string;
    link: string;
    source: string;
    snippet: string;
    date: string;
    negativeNewsTopics?: string[];
    hasNegativeNews?: boolean;
    summary?: string;
}


export interface CustomerRiskAssessmentModel {
    rating: string;
    score: number;
    error?: string;
}

export interface ReviewCaseModel {
    id: string;
    counterparty: PersonModel;
    customerOutreach?: string;
    documents: DocumentModel[];
}

export interface ApproveCaseModel {
    id: string;
    customerOutreach: string;
    documents: DocumentModel[];
}

export interface KycCaseSummaryModel {
    summary: string;
    error?: string;
}

export interface DocumentRef {
    url: string;
}

export const isDocumentRef = (val: any): val is DocumentRef => {
    return !!val && !!val.url;
}

export interface DocumentContent {
    content: Buffer;
}

export const isDocumentContent = (val: any): val is DocumentContent => {
    return !!val && !!val.content;
}

export interface DocumentStream {
    stream: Stream;
}

export const isDocumentStream = (val: any): val is DocumentStream => {
    return !!val && !!val.stream;
}

export interface DocumentInputModel {
    id: string;
    name: string;
    path: string;
}

export const createEmptyCase = (): KycCaseModel => {
    return {
        id: 'new',
        customer: {
            name: '',
            countryOfResidence: 'United States',
            personalIdentificationNumber: '',
            industryType: 'Private Limited Company',
            entityType: 'Growing of rice',
        },
        status: 'New',
        documents: [],
    }
}

export const createNewCase = (customer: CustomerModel): KycCaseModel => {
    return {
        id: '',
        customer,
        status: 'New',
        documents: [],
    }
}
