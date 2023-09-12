import {Field, ID, InputType, ObjectType} from "@nestjs/graphql";
import {
    ApproveCaseModel,
    CustomerModel,
    CustomerRiskAssessmentModel, DocumentInputModel,
    DocumentModel,
    KycCaseModel,
    NegativeScreeningModel, PersonModel, ReviewCaseModel
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
    riskCategory: string;
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
}

@ObjectType({ description: 'Negative screening' })
export class NegativeScreening implements NegativeScreeningModel {
    @Field()
    result: string;
}

@ObjectType({ description: 'Customer risk assessment' })
export class CustomerRiskAssessment implements CustomerRiskAssessmentModel {
    @Field()
    rating: string;
    @Field()
    score: number;
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
    counterparty: PersonModel;
    @Field({nullable: true})
    customerOutreach: string;
    @Field(() => NegativeScreening, {nullable: true})
    negativeScreening: NegativeScreeningModel;
    @Field(() => NegativeScreening, {nullable: true})
    counterpartyNegativeScreening: NegativeScreeningModel;
    @Field(() => CustomerRiskAssessment, {nullable: true})
    customerRiskAssessment: CustomerRiskAssessmentModel;
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
    riskCategory: string;
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
    @Field()
    name: string;
    @Field()
    path: string;
}
