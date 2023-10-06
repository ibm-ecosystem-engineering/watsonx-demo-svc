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
    DocumentModel,
    KycCaseChangeEventModel,
    KycCaseChangeEventThinModel,
    KycCaseModel,
    ReviewCaseModel
} from "../../models";
import {KycCaseManagementApi} from "../../services";

const pubSub: PubSub = new PubSub();
const casesTrigger: string = 'cases';
const caseTrigger: string = 'case';

const buildCaseTrigger = (id: string) => `${caseTrigger}/${id}`;

@Resolver(() => [KycCase])
export class KycCaseResolver {
    private casesTriggered = false;
    private caseTriggered = false;

    constructor(private readonly service: KycCaseManagementApi) {
        service.watchCaseChanges().subscribe({
            next: event => {
                const id = event.kycCase?.id

                if (id) {
                    console.log('Publishing case: ' + id);
                    pubSub.publish(buildCaseTrigger(id), event.kycCase)
                        .catch(err => console.log('Error triggering case: ', {err}));
                }
            }
        })
    }

    @Query(() => [KycCase])
    async listCases(): Promise<KycCaseModel[]> {
        return this.service.listCases();
    }

    @Query(() => [Document])
    async listDocuments(): Promise<DocumentModel[]> {
        return this.service.listDocuments();
    }

    @Subscription(() => [KycCase], {
        resolve: payload => payload
    })
    subscribeToCases() {
        const trigger = casesTrigger;

        const publish = async () => {
            const cases = await this.service.listCases();

            console.log('Publishing cases', {cases: cases.length})

            pubSub.publish(trigger, cases)
                .catch(err => console.error(`Error publishing (${trigger}): `, {err}))
        }

        publish().catch(err => console.error(err.message, {err}))

        if (!this.casesTriggered) {
            this.service.watchCaseChanges()
                .subscribe({
                    next: async () => publish(),
                    error: err => console.error('Error handling cases subscription', err),
                    complete: () => console.log('Complete')
                })
            this.casesTriggered = true;
        }

        return pubSub.asyncIterator(trigger);
    }

    @Subscription(() => KycCaseChangeEvent, {
        resolve: payload => payload
    })
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

    @Subscription(() => KycCase, {
        resolve: payload => payload
    })
    watchCase(
        @Args('id', { type: () => ID }) id: string
    ) {

        console.log('Subscribing to watching case: ' + id)
        this.service.getCase(id)
            .then(val => {
                return pubSub.publish(buildCaseTrigger(id), val)
            })

        return pubSub.asyncIterator(buildCaseTrigger(id));
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
