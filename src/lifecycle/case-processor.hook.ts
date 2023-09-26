import {Injectable, OnApplicationBootstrap} from "@nestjs/common";
import {
    DocumentManagerApi,
    KycCaseManagementApi,
    KycCaseSummaryApi,
    NegativeNewsApi
} from "../services";
import {CustomerRiskAssessmentModel, KycCaseChangeEventModel, KycCaseModel} from "../models";
import {
    Cp4adminCustomerRiskAssessmentCustomerRiskAssessmentApiFactory,
    customerRiskAssessmentConfig
} from "../services/customer-risk-assessment";

@Injectable()
export class CaseProcessorHook implements OnApplicationBootstrap {
    constructor(
        private readonly caseManager: KycCaseManagementApi,
        private readonly negNewsService: NegativeNewsApi,
        private readonly kycSummaryService: KycCaseSummaryApi,
        private readonly documentManagerService: DocumentManagerApi,
    ) {}

    onApplicationBootstrap(): any {
        console.log('Application bootstrap!')

        this.caseManager.watchCaseChanges()
            .subscribe({next: this.handleCaseChange.bind(this)})
    }

    handleCaseChange(event: KycCaseChangeEventModel) {
        console.log('Case change: ', event)

        const kycCase = event.kycCase;
        if (event.event === 'deleted') {
            return
        }

        if (event.kycCase.status !== 'Pending') {
            return
        }

        if (!kycCase.customerRiskAssessmentComplete) {
            return this.customerRiskAssessment(kycCase)
                .then(customerRiskAssessment => {
                    return this.caseManager.updateCustomerRiskAssessment(kycCase.id, customerRiskAssessment)
                })
        }

        if (!kycCase.negativeScreeningComplete) {
            return this.negNewsService
                .screenPerson(kycCase.customer)
                .then(negativeNews => {
                    return this.caseManager.updateNegativeNews(kycCase.id, negativeNews)
                })
        }

        if (!kycCase.counterpartyNegativeScreeningComplete) {
            return this.negNewsService
                .screenPerson(kycCase.counterparty)
                .then(negativeNews => {
                    return this.caseManager.updateCounterpartyNegativeNews(kycCase.id, negativeNews)
                })
        }

        if (!kycCase.caseSummaryComplete) {
            return this.kycSummaryService
                .summarize(kycCase.customer.name)
                .then(summary => ({summary}))
                .catch(err => ({
                    summary: 'N/A',
                    error: err.message,
                }))
                .then(summary => {
                    return this.caseManager.updateCaseSummary(kycCase.id, summary)
                })
        }
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
            .catch(err => ({
                error: err.message,
                score: 0,
                rating: 'N/A',
            }))
    }

}