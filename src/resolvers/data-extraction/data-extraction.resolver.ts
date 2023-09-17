import {Args, Query, Resolver, Subscription} from "@nestjs/graphql";
import {PubSub} from "graphql-subscriptions";

import {DataExtractionQuestion, DataExtractionQuestionIdInput, DataExtractionResult} from "../../graphql-types";
import {DataExtractionQuestionModel, DataExtractionResultModel} from "../../models";
import {DataExtractionApi} from "../../services";


@Resolver(() => DataExtractionResult)
export class DataExtractionResultResolver {

    constructor(private readonly service: DataExtractionApi) {
    }

    @Query(() => [DataExtractionResult])
    async extractDataForQuestions(
        @Args('customer', {type: () => String}) customer: string,
        @Args('questions', {type: () => [DataExtractionQuestionIdInput]}) questions: DataExtractionQuestionIdInput[],
    ): Promise<DataExtractionResultModel[]> {

        return this.service.extractData(customer, questions);
    }

    @Query(() => DataExtractionResult)
    async extractDataForQuestion(
        @Args('customer', {type: () => String}) customer: string,
        @Args('question', {type: () => DataExtractionQuestionIdInput}) question: DataExtractionQuestionIdInput,
    ): Promise<DataExtractionResultModel> {

        return this.service.extractDataForQuestion(customer, question);
    }

    @Subscription(() => [DataExtractionResult])
    async extractDataObservable(
        @Args('customer', {type: () => String}) customer: string,
        @Args('questions', {type: () => [DataExtractionQuestionIdInput]}) questions: DataExtractionQuestionIdInput[],
    ) {
        const trigger = 'data-extraction';

        const pubSub: PubSub = new PubSub();

        const publish = (value: DataExtractionResultModel[]) => {
            pubSub.publish(trigger, value);
        }

        this.service
            .extractDataObservable(customer, questions)
            .forEach(publish)
            .then(() => {

            })

        return pubSub.asyncIterator(trigger)
    }

}

@Resolver(() => DataExtractionQuestion)
export class DataExtractionQuestionResolver {

    constructor(private readonly service: DataExtractionApi) {
    }

    @Query(() => [DataExtractionQuestion])
    async listQuestions(): Promise<DataExtractionQuestionModel[]> {
        return this.service.listQuestions();
    }
}