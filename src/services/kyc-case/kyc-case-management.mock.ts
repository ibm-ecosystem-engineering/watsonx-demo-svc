import {BehaviorSubject, Observable, Subject} from "rxjs";
import * as Stream from "stream";

import {CaseNotFound, KycCaseManagementApi} from "./kyc-case-management.api";
import {
    ApproveCaseModel,
    createNewCase,
    CustomerModel,
    CustomerRiskAssessmentModel,
    DocumentContent,
    DocumentModel,
    DocumentRef,
    DocumentStream,
    isDocumentContent,
    isDocumentRef,
    KycCaseChangeEventModel,
    KycCaseModel,
    KycCaseSummaryModel,
    NegativeScreeningModel,
    PersonModel,
    ReviewCaseModel
} from "../../models";
import {delay, first, streamToBuffer, urlToStream} from "../../utils";
import {
    Cp4adminCustomerRiskAssessmentCustomerRiskAssessmentApiFactory,
    customerRiskAssessmentConfig
} from "../customer-risk-assessment";
import {negativeNewsApi, NegativeNewsApi} from "../negative-news";
import {kycCaseSummaryApi, KycCaseSummaryApi} from "../kyc-case-summary";
import {documentManagerApi, DocumentManagerApi} from "../document-manager";

const initialValue: KycCaseModel[] = [
    {
        id: '1',
        customer: {
            name: 'John Doe',
            countryOfResidence: 'United States',
            personalIdentificationNumber: '123458690',
            entityType: 'Private Limited Company',
            industryType: 'Growing of rice',
        },
        status: 'New',
        documents: [],
    },
    {
        id: '2',
        customer: {
            name: 'Jane Doe',
            countryOfResidence: 'Canada',
            personalIdentificationNumber: 'AB1458690',
            entityType: 'Sole Trader',
            industryType: 'Extraction of crude petroleum',
        },
        status: 'New',
        documents: [],
    }
]

export class KycCaseManagementMock implements KycCaseManagementApi {
    subject: BehaviorSubject<KycCaseModel[]> = new BehaviorSubject(initialValue);
    changeSubject: Subject<KycCaseChangeEventModel> = new Subject();

    constructor(
        private readonly negNewsService: NegativeNewsApi = negativeNewsApi(),
        private readonly kycSummaryService: KycCaseSummaryApi = kycCaseSummaryApi(),
        private readonly documentManagerService: DocumentManagerApi = documentManagerApi(),
    ) {}

    async listCases(): Promise<KycCaseModel[]> {
        return delay(1000, () => this.subject.value);
    }

    async getCase(id: string): Promise<KycCaseModel> {
        const filteredData = this.subject.value.filter(d => d.id === id)

        if (filteredData.length === 0) {
            throw new CaseNotFound(id);
        }

        return delay(1000, () => filteredData[0]);
    }

    subscribeToCases(): Observable<KycCaseModel[]> {
        console.log('Subscribing to cases: ', {value: this.subject.value})

        return this.subject;
    }

    async createCase(customer: CustomerModel): Promise<KycCaseModel> {

        const currentData = this.subject.value;

        const newCase = Object.assign(
            createNewCase(customer),
            {id: '' + (currentData.length + 1), status: 'New'}
        );

        const updatedData = currentData.concat(newCase);
        console.log('Updated data on create case: ', updatedData);
        this.subject.next(updatedData);
        this.changeSubject.next({kycCase: newCase, event: 'created'})

        return newCase;
    }

    async addDocumentToCase(caseId: string, documentName: string, document: DocumentRef | DocumentContent | DocumentStream, pathPrefix: string = ''): Promise<DocumentModel> {
        const kycCase = await this.getCase(caseId);

        const content = await this.loadDocument(document);

        const newDoc = await this.documentManagerService.uploadFile({
            name: documentName,
            parentId: caseId,
            content: {buffer: content},
            context: 'kyc-case',
        })

        const caseDoc = Object.assign({}, newDoc, {path: `${pathPrefix}${newDoc.path}`, content})

        kycCase.documents.push(caseDoc);

        this.subject.next(this.subject.value);
        this.changeSubject.next({kycCase, event: 'updated'})

        return caseDoc;
    }

    async loadDocument(document: DocumentRef | DocumentContent | DocumentStream): Promise<Buffer> {
        if (isDocumentContent(document)) {
            return document.content;
        }

        const stream: Stream = isDocumentRef(document)
            ? await urlToStream(document.url)
            : document.stream;

        return streamToBuffer(stream);
    }

    async getDocument(id: string): Promise<DocumentModel> {
        const doc: DocumentModel | undefined = first(
            this.subject.value
                .map(kycCase => first(kycCase.documents.filter(tmp => tmp.id === id)))
                .filter(doc => !!doc)
        )

        if (!doc) {
            throw new Error('Document not found: ' + id);
        }

        return doc;
    }

    async removeDocumentFromCase(caseId: string, documentId: string): Promise<KycCaseModel> {
        const kycCase = await this.getCase(caseId);

        kycCase.documents = kycCase.documents
            .filter(doc => doc.id !== documentId)

        this.subject.next(this.subject.value);
        this.changeSubject.next({kycCase, event: 'updated'})

        return kycCase;
    }

    async reviewCase(reviewCase: ReviewCaseModel): Promise<KycCaseModel> {
        const kycCase: KycCaseModel | undefined = first(this.subject.value.filter(c => c.id === reviewCase.id));

        if (!kycCase) {
            throw new CaseNotFound(reviewCase.id);
        }

        const status = reviewCase.customerOutreach ? 'CustomerOutreach' : 'Pending';

        Object.assign(kycCase, reviewCase, {status});

        this.subject.next(this.subject.value);
        this.changeSubject.next({kycCase, event: 'updated'})

        return kycCase;
    }

    async approveCase(input: ApproveCaseModel): Promise<KycCaseModel> {
        const kycCase: KycCaseModel | undefined = first(this.subject.value.filter(c => c.id === input.id));

        if (!kycCase) {
            throw new CaseNotFound(input.id);
        }

        kycCase.status = 'Pending';
        kycCase.documents = kycCase.documents.concat(input.documents)

        this.subject.next(this.subject.value);
        this.changeSubject.next({kycCase, event: 'updated'})

        return kycCase;
    }

    async processCase(id: string): Promise<KycCaseModel> {
        const kycCase = await this.getCase(id);

        Object.assign(kycCase, {
            status: 'Pending',
            negativeScreeningComplete: false,
            counterpartyNegativeScreeningComplete: false,
            customerRiskAssessmentComplete: false,
            caseSummaryComplete: false,
        })

        this.changeSubject.next({kycCase, event: 'updated'})

        return kycCase;
    }

    async deleteCase(caseId: string): Promise<KycCaseModel> {
        const cases: KycCaseModel[] = this.subject.value

        const index: number = cases.map(val => val.id).indexOf(caseId)

        const kycCase: KycCaseModel = first(cases.splice(index, 1))

        this.subject.next(cases)
        this.changeSubject.next({kycCase, event: 'deleted'})

        return kycCase
    }

    async updateCaseSummary(id: string, summarize: KycCaseSummaryModel): Promise<KycCaseModel> {
        const kycCase = await this.getCase(id);

        kycCase.caseSummary = {summary: summarize.summary}

        this.subject.next(this.subject.value);
        this.changeSubject.next({kycCase, event: 'updated'})

        return kycCase;
    }

    async updateCounterpartyNegativeNews(id: string, counterpartyNegativeScreening: NegativeScreeningModel): Promise<KycCaseModel> {
        const kycCase = await this.getCase(id);

        kycCase.counterpartyNegativeScreening = counterpartyNegativeScreening;

        this.subject.next(this.subject.value);
        this.changeSubject.next({kycCase, event: 'updated'})

        return kycCase;
    }

    async updateCustomerRiskAssessment(id: string, customerRiskAssessment: CustomerRiskAssessmentModel): Promise<KycCaseModel> {
        const kycCase = await this.getCase(id);

        kycCase.customerRiskAssessment = customerRiskAssessment;

        this.subject.next(this.subject.value);
        this.changeSubject.next({kycCase, event: 'updated'})

        return kycCase;
    }

    async updateNegativeNews(id: string, negativeScreening: NegativeScreeningModel): Promise<KycCaseModel> {
        const kycCase = await this.getCase(id);

        kycCase.negativeScreening = negativeScreening;

        this.subject.next(this.subject.value);
        this.changeSubject.next({kycCase, event: 'updated'})

        return kycCase;
    }

    watchCaseChanges(): Observable<KycCaseChangeEventModel> {
        return this.changeSubject;
    }

    watchCase(id: string): Observable<KycCaseModel> {
        const subject: BehaviorSubject<KycCaseModel> = new BehaviorSubject<KycCaseModel>(undefined);

        this.getCase(id).then(kycCase => {
            subject.next(kycCase);

            this.changeSubject.subscribe({
                next: event => {
                    if (event.kycCase.id === id) {
                        subject.next(event.kycCase);
                    }
                }
            })
        });

        return subject;
    }

    async listDocuments(): Promise<DocumentModel[]> {
        return this.subject.value
            .map(val => val.documents)
            .reduce((result: DocumentModel[], current: DocumentModel[]) => {
                result.push(...current);

                return result;
            }, [])
    }

    async deleteDocument(): Promise<DocumentModel> {
        return undefined;
    }
}
