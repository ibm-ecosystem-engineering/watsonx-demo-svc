import {Body, Controller, Get, Post} from "@nestjs/common";

import {
    Cp4adminCustomerRiskAssessmentCustomerRiskAssessmentApiFactory,
    CustomerRiskAssessmentRisk0020AssessmentInput
} from "../../services/customer-risk-assessment";
import {customerRiskAssessmentConfig} from "../../config";
import {ApiPropertyOptional, ApiTags} from "@nestjs/swagger";
import {MenuOptionsApi} from "../../services";

class CustomerRiskAssessmentInput implements CustomerRiskAssessmentRisk0020AssessmentInput {
    @ApiPropertyOptional()
    nonPersonalEntityType: string;
    @ApiPropertyOptional()
    nonPersonalGeographyType: string;
    @ApiPropertyOptional()
    nonPersonalIndustryType: string;
}

@ApiTags('customer-risk')
@Controller('customer-risk')
export class CustomerRiskAssessmentController {

    constructor(private readonly service: MenuOptionsApi) {
    }

    @Post('risk-assessment')
    async riskAssessment(@Body() input: CustomerRiskAssessmentInput) {
        const config = customerRiskAssessmentConfig();

        const api = Cp4adminCustomerRiskAssessmentCustomerRiskAssessmentApiFactory(config);

        return api.customerRiskAssessmentRiskAssessment(input);
    }

    @Get('countries')
    async listCountries() {
        return this.service.getCountryList();
    }

    @Get('industry-types')
    async listIndustryTypes() {
        return this.service.getIndustries();
    }

    @Get('entity-types')
    async listEntityTypes() {
        return this.service.getEntityTypes();
    }
}
