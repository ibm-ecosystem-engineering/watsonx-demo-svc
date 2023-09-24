import {Args, Field, ObjectType, Query, Resolver} from "@nestjs/graphql";

import {NegativeScreening} from "../../graphql-types";
import {NegativeNewsApi} from "../../services";

@ObjectType()
class ValidatedUrl {
    @Field()
    link: string;
    @Field()
    isValid: boolean;
}

@Resolver(() => NegativeScreening)
export class NegativeNewsResolver {

    constructor(private readonly service: NegativeNewsApi) {}

    @Query(() => NegativeScreening)
    async screenNews(
        @Args('name') name: string,
        @Args('country', {nullable: true}) countryOfResidence: string = '',
        @Args('dateOfBirth', {nullable: true}) dateOfBirth: string
    ) {
        const result = await this.service.screenPerson({name, countryOfResidence})

        console.log('Result: ', result);

        return result
    }

    @Query(() => ValidatedUrl)
    async validateUrl(
        @Args('url') link: string,
    ) {
        return this.service.validateUrl({link})
    }
}