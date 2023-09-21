import {BehaviorSubject, Observable} from "rxjs";
import {getType} from 'mime';
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
import {NegativeNewsApi} from "../negative-news";
import {NegativeNewsImpl} from "../negative-news/negative-news.impl";
import {KycCaseSummaryApi} from "../kyc-case-summary";
import {KycCaseSummaryImpl} from "../kyc-case-summary/kyc-case-summary.impl";

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

    constructor(
        private readonly negNewsService: NegativeNewsApi = new NegativeNewsImpl(),
        private readonly kycSummaryService: KycCaseSummaryApi = new KycCaseSummaryImpl()) {
    }

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

        return newCase;
    }

    async addDocumentToCase(caseId: string, documentName: string, document: DocumentRef | DocumentContent | DocumentStream, pathPrefix: string = ''): Promise<DocumentModel> {
        const currentCase = await this.getCase(caseId);

        const id = '' + (currentCase.documents.length + 1);
        const documentId = `${caseId}-${id}`;
        const content = await this.loadDocument(document);

        const newDoc = {id: documentId, name: documentName, path: `${pathPrefix}${documentId}/${documentName}`, content};

        currentCase.documents.push(newDoc);

        this.subject.next(this.subject.value);

        return newDoc;
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
        const currentCase = await this.getCase(caseId);

        currentCase.documents = currentCase.documents
            .filter(doc => doc.id !== documentId)

        this.subject.next(this.subject.value);

        return currentCase;
    }

    async reviewCase(reviewCase: ReviewCaseModel): Promise<KycCaseModel> {
        const currentCase: KycCaseModel | undefined = first(this.subject.value.filter(c => c.id === reviewCase.id));

        if (!currentCase) {
            throw new CaseNotFound(reviewCase.id);
        }

        const status = reviewCase.customerOutreach ? 'CustomerOutreach' : 'Pending';

        Object.assign(currentCase, reviewCase, {status});

        this.subject.next(this.subject.value);

        if (status === 'Pending') {
            this.processCaseInternal(currentCase)
                .catch(err => console.error('Error processing case', {err}))
        }

        return currentCase;
    }

    async approveCase(input: ApproveCaseModel): Promise<KycCaseModel> {
        const currentCase: KycCaseModel | undefined = first(this.subject.value.filter(c => c.id === input.id));

        if (!currentCase) {
            throw new CaseNotFound(input.id);
        }

        currentCase.status = 'Pending';
        currentCase.documents = currentCase.documents.concat(input.documents)

        this.subject.next(this.subject.value);

        this.processCaseInternal(currentCase)
            .catch(err => console.error('Error processing case', {err}))

        return currentCase;
    }

    async processCase(id: string): Promise<KycCaseModel> {
        const currentCase = await this.getCase(id);


        this.processCaseInternal(currentCase)
            .catch(err => console.error('Error processing case', {err}))

        return currentCase;
    }

    async processCaseInternal(currentCase: KycCaseModel) {

        const getSubjectCase = (currentCase: {id: string}): KycCaseModel => {
            return first(this.subject.value
                .filter(val => val.id === currentCase.id))
        }

        this.customerRiskAssessment(currentCase)
            .then(riskAssessment => {
                const subjectCase = getSubjectCase(currentCase);

                subjectCase.customerRiskAssessment = riskAssessment

                this.subject.next(this.subject.value);
            })
            .catch(err => {
                const subjectCase = getSubjectCase(currentCase);

                console.log('Error getting customer risk assessment: ', {err})

                subjectCase.customerRiskAssessment = {
                    error: err.message,
                    score: 0,
                    rating: 'N/A'
                };

                this.subject.next(this.subject.value);
            });

        this.negativeNews(currentCase.customer, currentCase.negativeScreening)
            .then(news => {
                const subjectCase = getSubjectCase(currentCase);

                subjectCase.negativeScreening = news

                this.subject.next(this.subject.value);
            })
            .catch(err => {
                const subjectCase = getSubjectCase(currentCase);

                console.log('Error getting negative screening: ', {err})

                subjectCase.negativeScreening = {
                    result: 'N/A',
                    error: err.message,
                }

                this.subject.next(this.subject.value);
            })

        this.negativeNews(currentCase.counterparty, currentCase.counterpartyNegativeScreening)
            .then(news => {
                const subjectCase = getSubjectCase(currentCase);

                subjectCase.counterpartyNegativeScreening = news

                this.subject.next(this.subject.value);
            })
            .catch(err => {
                const subjectCase = getSubjectCase(currentCase);

                console.log('Error getting counterparty negative screening: ', {err})

                subjectCase.counterpartyNegativeScreening = {
                    result: 'N/A',
                    error: err.message,
                }

                this.subject.next(this.subject.value);
            })

        this.summarizeCase(currentCase)
            .then(summarize => {
                const subjectCase = getSubjectCase(currentCase);

                subjectCase.caseSummary = {summary: summarize.summary}

                this.subject.next(this.subject.value);
            })
            .catch(err => {
                const subjectCase = getSubjectCase(currentCase);

                console.log('Error getting case summary: ', {err})
                subjectCase.caseSummary = {
                    summary: 'N/A',
                    error: err.message,
                }

                this.subject.next(this.subject.value);
            })
    }

    async negativeNews(person: PersonModel, currentNews?: NegativeScreeningModel): Promise<NegativeScreeningModel> {
        if (currentNews && !currentNews.error) {
            return currentNews;
        }

        return this.negNewsService.screenPerson(person)
            .then(result => ({result: result.summary}))
    }

    async customerRiskAssessment(kycCase: KycCaseModel): Promise<CustomerRiskAssessmentModel> {
        const config = customerRiskAssessmentConfig();

        if (kycCase.customerRiskAssessment && !kycCase.customerRiskAssessment.error) {
            return kycCase.customerRiskAssessment;
        }

        const api = Cp4adminCustomerRiskAssessmentCustomerRiskAssessmentApiFactory(config);

        const body = {
            nonPersonalEntityType: kycCase.customer.entityType,
            nonPersonalGeographyType: kycCase.customer.countryOfResidence,
            nonPersonalIndustryType: kycCase.customer.industryType,
        };

        console.log('Getting customer risk assessment: ', body)
        return api
            .customerRiskAssessmentRiskAssessment(body)
            .then(result => result.data)
            .then(riskAssessment => ({
                score: riskAssessment.customerRiskAssessmentScore || 0,
                rating: riskAssessment.customerRiskAssessmentRating || 'N/A',
            }))
    }

    async summarizeCase(kycCase: KycCaseModel): Promise<KycCaseSummaryModel> {


        console.log('Getting summary: ' + kycCase.customer.name)

        const result = await this.kycSummaryService.summarize(kycCase.customer.name);

        console.log('Summarize result: ', {summary: result});

        return {summary: result};
    }

    findFinancialDoc(documents: DocumentModel[]): DocumentModel | undefined {
        const financialDocRegEx = /.*financial.*/ig
        const annualDocRegEx = /.*annual.*/ig

        const doc = first(documents
            .filter(doc => financialDocRegEx.test(doc.name) || annualDocRegEx.test(doc.name)))

        if (doc) {
            return doc;
        }

        return documents.length > 0 ? documents[0] : undefined;
    }
}
