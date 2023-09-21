import {Args, Field, ObjectType, Query, Resolver} from "@nestjs/graphql";
import {KycCaseSummaryApi} from "../../services";

@ObjectType()
class SummaryResult {
    @Field()
    result: string;
}

@Resolver(() => String)
export class KycCaseSummaryResolver {
    constructor(private readonly service: KycCaseSummaryApi) {}

    @Query(() => SummaryResult)
    async summarize(
        @Args('name') name: string,
    ): Promise<{result: string}> {
        return this.service.summarize(name).then(result => ({result}));
    }
}