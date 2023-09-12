import {BehaviorSubject, Observable} from "rxjs";

import {CaseNotFound, KycCaseManagementApi} from "./kyc-case-management.api";
import {ApproveCaseModel, createNewCase, CustomerModel, KycCaseModel, ReviewCaseModel} from "../../models";
import {delay, first} from "../../utils";
import {Cp4adminCustomerRiskAssessmentCustomerRiskAssessmentApiFactory} from "../customer-risk-assessment";
import {customerRiskAssessmentConfig} from "../../config";

const initialValue: KycCaseModel[] = [
    {
        id: '1',
        customer: {
            name: 'John Doe',
            countryOfResidence: 'US',
            personalIdentificationNumber: '123458690',
            riskCategory: 'Low',
            entityType: 'Individual',
            industryType: 'Oil and Gas'
        },
        status: 'New',
        documents: [],
    },
    {
        id: '2',
        customer: {
            name: 'Jane Doe',
            countryOfResidence: 'CA',
            personalIdentificationNumber: 'AB1458690',
            riskCategory: 'Low',
            entityType: 'Individual',
            industryType: 'Oil and Gas'
        },
        status: 'New',
        documents: [],
    }
]

export class KycCaseManagementMock implements KycCaseManagementApi {
    subject: BehaviorSubject<KycCaseModel[]> = new BehaviorSubject(initialValue)

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

    async addDocumentToCase(caseId: string, documentName: string, documentPath: string): Promise<KycCaseModel> {
        const currentCase = await this.getCase(caseId);

        currentCase.status = 'Pending';

        const id = '' + (currentCase.documents.length + 1);

        currentCase.documents.push({id: `${caseId}-${id}`, name: documentName, path: documentPath});

        this.subject.next(this.subject.value);

        return currentCase;
    }

    async reviewCase(reviewCase: ReviewCaseModel): Promise<KycCaseModel> {
        const currentCase: KycCaseModel | undefined = first(this.subject.value.filter(c => c.id === reviewCase.id));

        if (!currentCase) {
            throw new CaseNotFound(reviewCase.id);
        }

        const status = reviewCase.customerOutreach ? 'CustomerOutreach' : 'Pending';

        Object.assign(currentCase, {reviewCase}, {status});

        this.subject.next(this.subject.value);



        this.customerRiskAssessment(currentCase)
            .then(riskAssessment => {
                currentCase.customerRiskAssessment = {
                    score: riskAssessment.customerRiskAssessmentScore || 0,
                    rating: riskAssessment.customerRiskAssessmentRating || 'N/A',
                }

                this.subject.next(this.subject.value);
            })

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

        return currentCase;
    }

    async negativeNews(kycCase: KycCaseModel) {

    }

    async customerRiskAssessment(kycCase: KycCaseModel) {
        const config = customerRiskAssessmentConfig();

        const api = Cp4adminCustomerRiskAssessmentCustomerRiskAssessmentApiFactory(config);

        return api
            .customerRiskAssessmentRiskAssessment({
                nonPersonalEntityType: kycCase.customer.entityType,
                nonPersonalGeographyType: kycCase.customer.countryOfResidence,
                nonPersonalIndustryType: kycCase.customer.industryType,
            })
            .then(result => result.data)
    }
}
