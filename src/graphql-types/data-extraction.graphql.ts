import {Field, ID, InputType, ObjectType} from "@nestjs/graphql";
import {GraphQLBoolean} from "graphql/type";

import {DataExtractionQuestionModel, DataExtractionResultModel} from "../models";

@ObjectType({description: 'Data extraction question'})
export class DataExtractionQuestion implements DataExtractionQuestionModel {
    @Field(() => ID)
    id: string;
    @Field(() => GraphQLBoolean)
    inScope: boolean;
    @Field()
    question: string;
}

@InputType({description: 'Data extraction question input'})
export class DataExtractionQuestionIdInput {
    @Field(() => ID)
    id: string;
}

@ObjectType({description: 'Data extraction result'})
export class DataExtractionResult implements DataExtractionResultModel {
    @Field(() => ID)
    id: string;
    @Field(() => GraphQLBoolean)
    inScope: boolean;
    @Field()
    question: string;
    @Field()
    expectedResponse: string;
    @Field()
    watsonxResponse: string;
    @Field()
    prompt: string;
}

