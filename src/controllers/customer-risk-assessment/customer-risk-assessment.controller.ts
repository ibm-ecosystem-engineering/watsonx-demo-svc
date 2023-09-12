import {Body, Controller, Post} from "@nestjs/common";

import {
    Cp4adminCustomerRiskAssessmentCustomerRiskAssessmentApiFactory,
    CustomerRiskAssessmentRisk0020AssessmentInput
} from "../../services/customer-risk-assessment";
import {customerRiskAssessmentConfig} from "../../config";
import {ApiPropertyOptional, ApiTags} from "@nestjs/swagger";

class CustomerRiskAssessmentInput implements CustomerRiskAssessmentRisk0020AssessmentInput {
    @ApiPropertyOptional()
    nonPersonalEntityType: string;
    @ApiPropertyOptional()
    nonPersonalGeographyType: string;
    @ApiPropertyOptional()
    nonPersonalIndustryType: string;
}

@ApiTags('customer-risk')
@Controller('customer-risk-assessment')
export class CustomerRiskAssessmentController {

    @Post()
    async riskAssessment(@Body() input: CustomerRiskAssessmentInput) {
        const config = customerRiskAssessmentConfig();

        const api = Cp4adminCustomerRiskAssessmentCustomerRiskAssessmentApiFactory(config);

        return api.customerRiskAssessmentRiskAssessment(input);
    }
}
