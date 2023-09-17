import {Query, Resolver} from "@nestjs/graphql";

import {FormOption} from "../../graphql-types";
import {FormOptionModel} from "../../models";
import {MenuOptionsApi} from "../../services";

@Resolver(() => FormOption)
export class FormOptionResolver {

    constructor(private readonly service: MenuOptionsApi) {
    }

    @Query(() => [FormOption])
    async listCountries(): Promise<FormOptionModel[]> {
        return this.service.getCountryList();
    }

    @Query(() => [FormOption])
    async listEntityTypes(): Promise<FormOptionModel[]> {
        return this.service.getEntityTypes();
    }

    @Query(() => [FormOption])
    async listIndustryTypes(): Promise<FormOptionModel[]> {
        return this.service.getIndustries();
    }

}