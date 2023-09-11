import {Controller, Get, Query} from "@nestjs/common";

import {DataExtractionApi} from "../../services/data-extraction";
import {ApiTags} from "@nestjs/swagger";

@ApiTags('data-extraction')
@Controller('data-extraction')
export class DataExtractionController {
    constructor(private readonly service: DataExtractionApi) {}

    @Get('questions')
    listQuestions() {
        return this.service.listQuestions();
    }

    @Get('extractData')
    extractData(
        @Query('customer') customer: string,
        @Query('questionIds') idStrings: string | string[]
    ) {
        const questionIds = Array.isArray(idStrings) ? idStrings : [idStrings]

        return this.service.extractData(customer, questionIds.map(id => ({id})))
    }
}
