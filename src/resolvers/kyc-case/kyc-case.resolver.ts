import {Args, ID, Mutation, Query, Resolver, Subscription} from "@nestjs/graphql";
import {PubSub} from "graphql-subscriptions";

import {
    ApproveCaseInput,
    CustomerInput,
    Document,
    KycCase,
    KycCaseChangeEvent,
    ReviewCaseInput
} from "../../graphql-types";
import {
    ApproveCaseModel,
    CustomerModel,
    DocumentModel, KycCaseChangeEventModel,
    KycCaseChangeEventThinModel,
    KycCaseModel,
    ReviewCaseModel
} from "../../models";
import {KycCaseManagementApi} from "../../services";
import {KycCaseManagementMock} from "../../services/kyc-case/kyc-case-management.mock";

const pubSub: PubSub = new PubSub();
const casesTrigger: string = 'cases';
const caseTrigger: string = 'case';

@Resolver(() => [KycCase])
export class KycCaseResolver {
    private casesTriggered = false;
    private caseTriggered = false;

    constructor(private readonly service: KycCaseManagementApi) {
    }

    @Query(() => [KycCase])
    async listCases(): Promise<KycCaseModel[]> {
        return this.service.listCases();
    }

    @Query(() => [Document])
    async listDocuments(): Promise<DocumentModel[]> {
        return this.service.listDocuments();
    }

    @Subscription(() => [KycCase])
    subscribeToCases() {
        const trigger = casesTrigger;

        const publish = (cases: KycCaseModel[]) => {
            console.log('Publishing cases', {cases})

            pubSub.publish(trigger, cases)
                .catch(err => console.error(`Error publishing (${trigger}): `, {err}))
        }

        if (!this.casesTriggered) {
            publish([])

            this.service.subscribeToCases()
                .subscribe({
                    next: publish,
                    error: err => console.error('Error handling cases subscription', err),
                    complete: () => console.log('Complete')
                })
            this.casesTriggered = true;
        }

        return pubSub.asyncIterator(trigger);
    }

    @Subscription(() => KycCaseChangeEvent)
    subscribeToCaseChanges() {
        const trigger = caseTrigger;

        const publish = (event: KycCaseChangeEventModel) => {
            console.log('Publishing event', {event})

            const payload: KycCaseChangeEventThinModel = {event: event.event, caseId: event.kycCase.id}

            pubSub.publish(trigger, payload)
                .catch(err => console.error(`Error publishing (${trigger}): `, {err}))
        }

        if (!this.caseTriggered) {
            this.service
                .watchCaseChanges()
                .subscribe({
                    next: publish,
                    error: err => console.error('Error handling cases subscription', err),
                    complete: () => console.log('Complete')
                })
            this.caseTriggered = true;
        }

        return pubSub.asyncIterator(trigger);
    }

    @Subscription(() => KycCase)
    watchCase(
        @Args('id', { type: () => ID }) id: string
    ) {
        const trigger = `${caseTrigger}/${id}`;

        this.service.watchCase(id)
            .subscribe({
                next: kycCase => {
                    pubSub.publish(trigger, kycCase)
                        .catch(err => console.error(`Error publishing (${caseTrigger}): `, {err}))
                },
                error: err => console.error('Error handling cases subscription', err),
                complete: () => console.log('Complete')
            })

        return pubSub.asyncIterator(trigger);
    }

    @Query(() => KycCase)
    async getCase(
        @Args('id', { type: () => ID }) id: string
    ): Promise<KycCaseModel> {
        return this.service.getCase(id);
    }

    @Query(() => Document)
    async getDocument(
        @Args('id', { type: () => ID }) id: string
    ): Promise<DocumentModel> {
        return this.service.getDocument(id);
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
        @Args('documentUrl', { type: () => String }) documentUrl: string,
    ): Promise<DocumentModel> {
        return this.service.addDocumentToCase(caseId, documentName, {url: documentUrl});
    }

    @Mutation(() => KycCase)
    async removeDocumentFromCase(
        @Args('caseId', { type: () => ID }) caseId: string,
        @Args('documentId', { type: () => ID }) documentId: string,
    ): Promise<KycCaseModel> {
        return this.service.removeDocumentFromCase(caseId, documentId);
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

    @Mutation(() => KycCase)
    async processCase(
        @Args('id', { type: () => ID }) caseId: string,
    ): Promise<KycCaseModel> {
        return this.service.processCase(caseId);
    }

    @Mutation(() => KycCase)
    async deleteCase(
        @Args('id', { type: () => ID }) caseId: string,
    ): Promise<KycCaseModel> {
        return this.service.deleteCase(caseId);
    }

    @Mutation(() => Document)
    async deleteDocument(
        @Args('id', { type: () => ID }) id: string,
    ): Promise<DocumentModel> {
        return this.service.deleteDocument(id);
    }
}
