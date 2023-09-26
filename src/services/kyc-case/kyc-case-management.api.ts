import {Observable} from "rxjs";

import {
    ApproveCaseModel,
    CustomerModel, CustomerRiskAssessmentModel,
    DocumentContent,
    DocumentModel,
    DocumentRef,
    DocumentStream, KycCaseChangeEventModel,
    KycCaseModel, KycCaseSummaryModel, NegativeScreeningModel,
    ReviewCaseModel
} from "../../models";

export abstract class KycCaseManagementApi {
    abstract listCases(): Promise<KycCaseModel[]>;
    abstract subscribeToCases(skipQuery?: boolean): Observable<KycCaseModel[]>;

    abstract getCase(id: string): Promise<KycCaseModel>;
    abstract createCase(customer: CustomerModel): Promise<KycCaseModel>;
    abstract getDocument(id: string): Promise<DocumentModel>;
    abstract addDocumentToCase(id: string, documentName: string, document: DocumentRef | DocumentContent | DocumentStream, pathPrefix?: string): Promise<DocumentModel>;
    abstract removeDocumentFromCase(id: string, documentId: string): Promise<KycCaseModel>;
    abstract reviewCase(input: ReviewCaseModel): Promise<KycCaseModel>;
    abstract approveCase(input: ApproveCaseModel): Promise<KycCaseModel>;
    abstract processCase(id: string): Promise<KycCaseModel>;
    abstract deleteCase(id: string): Promise<KycCaseModel>;
    abstract updateCustomerRiskAssessment(id: string, customerRiskAssessment: CustomerRiskAssessmentModel): Promise<KycCaseModel>;
    abstract updateNegativeNews(id: string, negativeScreening: NegativeScreeningModel): Promise<KycCaseModel>;
    abstract updateCounterpartyNegativeNews(id: string, counterpartyNegativeScreening: NegativeScreeningModel): Promise<KycCaseModel>;
    abstract updateCaseSummary(id: string, caseSummary: KycCaseSummaryModel): Promise<KycCaseModel>;
    abstract watchCaseChanges(): Observable<KycCaseChangeEventModel>;
    abstract watchCase(id: string): Observable<KycCaseModel>;
    abstract listDocuments(): Promise<DocumentModel[]>;
    abstract deleteDocument(id: string): Promise<DocumentModel>;
}

export class CaseNotFound extends Error {
    constructor(public caseId: string) {
        super('Unable to find case: ' + caseId);
    }
}
