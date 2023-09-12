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
}

export interface PersonModel {
    name: string;
    countryOfResidence: string;
}

export interface CustomerModel extends PersonModel {
    personalIdentificationNumber: string;
    riskCategory: string;
    entityType: string;
    industryType: string;
}

export interface DocumentModel extends DocumentInputModel {
    id: string;
}

export interface NegativeScreeningModel {
    result: string;
}

export interface CustomerRiskAssessmentModel {
    rating: string;
    score: number;
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

export interface DocumentInputModel {
    name: string;
    path: string;
}

export const createEmptyCase = (): KycCaseModel => {
    return {
        id: 'new',
        customer: {
            name: '',
            countryOfResidence: 'US',
            personalIdentificationNumber: '',
            riskCategory: '',
            industryType: '',
            entityType: '',
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
