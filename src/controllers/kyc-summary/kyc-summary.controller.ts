import {Controller, Get, Param} from "@nestjs/common";
import {ApiTags} from "@nestjs/swagger";

import {KycCaseSummaryImpl} from "../../services/kyc-case-summary/kyc-case-summary.impl";
import {KycCaseSummaryApi} from "../../services";

@ApiTags('kyc-summary')
@Controller('kyc-summary')
export class KycSummaryController {
    api: KycCaseSummaryApi;

    constructor() {
        this.api = new KycCaseSummaryImpl();
    }

    @Get('summary/:name')
    async summary(
        @Param('name') name: string,
    ) : Promise<{summary: string}> {

        return this.api.summarize(name).then(summary => ({summary}));
    }
}
