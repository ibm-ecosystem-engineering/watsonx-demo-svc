import {Field, ID, InputType, ObjectType} from "@nestjs/graphql";
import {
    ApproveCaseModel,
    CustomerModel,
    CustomerRiskAssessmentModel, DocumentInputModel,
    DocumentModel,
    KycCaseModel, KycCaseSummaryModel,
    NegativeScreeningModel, NewsItemModel, PersonModel, ReviewCaseModel
} from "../models";

@ObjectType({description: 'KYC Customer'})
export class Customer implements CustomerModel {
    @Field()
    name: string;
    @Field()
    countryOfResidence: string;
    @Field()
    personalIdentificationNumber: string;
    @Field()
    entityType: string;
    @Field()
    industryType: string;
}

@ObjectType({description: 'KYC Person'})
export class Person implements PersonModel {
    @Field()
    name: string;
    @Field()
    countryOfResidence: string;
}

@ObjectType({ description: 'KYC Document' })
export class Document implements DocumentModel {
    @Field(() => ID)
    id: string;
    @Field()
    name: string;
    @Field()
    path: string;
    content: Buffer;
}

@ObjectType({ description: 'Negative screening' })
export class NegativeScreening implements NegativeScreeningModel {
    @Field()
    summary: string;
    @Field(() => String, {nullable: true})
    error?: string;
    @Field(() => [NewsItem])
    negativeNews: NewsItemModel[];
    @Field(() => [NewsItem])
    nonNegativeNews: NewsItemModel[];
    @Field()
    subject: string;
    @Field()
    totalScreened: number;
    @Field(() => [NewsItem])
    unrelatedNews: NewsItemModel[];
    @Field()
    negativeNewsCount: number;
    @Field()
    nonNegativeNewsCount: number;
    @Field()
    unrelatedNewsCount: number;
}

@ObjectType()
export class NewsItem implements NewsItemModel {
    @Field()
    date: string;
    @Field({nullable: true})
    hasNegativeNews?: boolean;
    @Field()
    link: string;
    @Field(() => [String], {nullable: true})
    negativeNewsTopics?: string[];
    @Field()
    snippet: string;
    @Field()
    source: string;
    @Field({nullable: true})
    summary?: string;
    @Field()
    title: string;
}

@ObjectType({ description: 'Customer risk assessment' })
export class CustomerRiskAssessment implements CustomerRiskAssessmentModel {
    @Field()
    rating: string;
    @Field()
    score: number;
    @Field(() => String, {nullable: true})
    error: string;
}

@ObjectType({ description: 'KYC Case' })
export class KycCase implements KycCaseModel {
    @Field(() => ID)
    id: string;
    @Field()
    status: string;
    @Field(() => Customer)
    customer: CustomerModel;
    @Field(() => [Document])
    documents: DocumentModel[];
    @Field(() => Person, {nullable: true})
    counterparty?: PersonModel;
    @Field({nullable: true})
    customerOutreach?: string;
    @Field(() => NegativeScreening, {nullable: true})
    negativeScreening?: NegativeScreeningModel;
    @Field(() => NegativeScreening, {nullable: true})
    counterpartyNegativeScreening?: NegativeScreeningModel;
    @Field(() => CustomerRiskAssessment, {nullable: true})
    customerRiskAssessment?: CustomerRiskAssessmentModel;
    @Field(() => KycCaseSummary, {nullable: true})
    caseSummary?: KycCaseSummaryModel;
}

@ObjectType({ description: 'KYC case summary' })
export class KycCaseSummary implements KycCaseSummaryModel {
    @Field()
    summary: string;
    @Field(() => String, {nullable: true})
    error: string;
}

@InputType()
export class CustomerInput implements CustomerModel {
    @Field()
    name: string;
    @Field()
    countryOfResidence: string;
    @Field()
    personalIdentificationNumber: string;
    @Field()
    entityType: string;
    @Field()
    industryType: string;
}

@InputType()
export class PersonInput implements PersonModel {
    @Field()
    name: string;
    @Field()
    countryOfResidence: string;
}

@InputType()
export class ReviewCaseInput implements ReviewCaseModel {
    @Field(() => ID)
    id: string
    @Field(() => PersonInput)
    counterparty: PersonModel
    @Field({nullable: true})
    customerOutreach: string;
    @Field(() => [DocumentInput])
    documents: DocumentModel[];
}

@InputType()
export class ApproveCaseInput implements ApproveCaseModel {
    @Field(() => ID)
    id: string
    @Field()
    customerOutreach: string;
    @Field(() => [DocumentInput])
    documents: DocumentModel[];
}

@InputType()
export class DocumentInput implements DocumentInputModel {
    @Field(() => ID)
    id: string;
    @Field()
    name: string;
    @Field()
    path: string;
}
