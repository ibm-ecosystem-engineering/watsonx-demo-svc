import {Args, ID, Mutation, Query, Resolver, Subscription} from "@nestjs/graphql";
import {PubSub} from "graphql-subscriptions";

import {ApproveCaseInput, CustomerInput, KycCase, ReviewCaseInput} from "../../graphql-types";
import {ApproveCaseModel, CustomerModel, KycCaseModel, ReviewCaseModel} from "../../models";
import {KycCaseManagementApi} from "../../services";

const pubSub: PubSub = new PubSub();
const casesTrigger: string = 'cases';

@Resolver(() => [KycCase])
export class KycCaseResolver {
    private triggered = false;

    constructor(private readonly service: KycCaseManagementApi) {
    }

    @Query(() => [KycCase])
    async listCases(): Promise<KycCaseModel[]> {
        return this.service.listCases();
    }

    @Subscription(() => [KycCase])
    subscribeToCases() {
        if (!this.triggered) {
            this.service.subscribeToCases()
                .subscribe({
                    next: cases => {
                        console.log('Publishing case', {cases})

                        pubSub.publish(casesTrigger, cases)
                    },
                    error: err => console.error('Error handling cases subscription', err),
                    complete: () => console.log('Complete')
                })
            this.triggered = true;
        }

        return pubSub.asyncIterator(casesTrigger);
    }

    @Query(() => KycCase)
    async getCase(
        @Args('id', { type: () => ID }) id: string
    ): Promise<KycCaseModel> {
        return this.service.getCase(id);
    }

    @Mutation(() => KycCase)
    async createCase(
        @Args('customer', { type: () => CustomerInput }) customer: CustomerModel,
    ): Promise<KycCaseModel> {
        return this.service.createCase(customer);
    }

    @Mutation(() => KycCase)
    async addDocumentToCase(
        @Args('caseId', { type: () => ID }) caseId: string,
        @Args('documentName', { type: () => String }) documentName: string,
        @Args('documentPath', { type: () => String }) documentPath: string,
    ): Promise<KycCaseModel> {
        return this.service.addDocumentToCase(caseId, documentName, documentPath);
    }

    @Mutation(() => KycCase)
    async reviewCase(
        @Args('case', { type: () => ReviewCaseInput }) reviewCase: ReviewCaseModel
    ): Promise<KycCaseModel> {
        return this.service.reviewCase(reviewCase);
    }

    @Mutation(() => KycCase)
    async approveCase(
        @Args('case', { type: () => ApproveCaseInput }) approveCase: ApproveCaseModel
    ): Promise<KycCaseModel> {
        return this.service.approveCase(approveCase);
    }
}
