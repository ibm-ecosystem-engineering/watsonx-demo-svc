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

        console.log('Extracting data for questions', JSON.stringify({customer, questions}))

        const result = await this.service.extractData(customer, questions);

        console.log('Got result', {result})

        return result;
    }

    @Query(() => DataExtractionResult)
    async extractDataForQuestion(
        @Args('customer', {type: () => String}) customer: string,
        @Args('question', {type: () => DataExtractionQuestionIdInput}) question: DataExtractionQuestionIdInput,
    ): Promise<DataExtractionResultModel> {

        console.log('Extracting data for question', JSON.stringify({customer, question}))

        const result = await this.service.extractDataForQuestion(customer, question);

        console.log('Got result', {result})

        return result
    }

    @Subscription(() => [DataExtractionResult], {
        resolve: payload => payload
    })
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