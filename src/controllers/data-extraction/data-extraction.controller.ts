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
    async extractData(
        @Query('customer') customer: string,
        @Query('questionIds') idStrings: string[] = []
    ) {
        const questionIds = Array.isArray(idStrings) ? idStrings : [idStrings]

        if (questionIds.length === 0) {
            questionIds.push(...(await this.service.listQuestions()).map(question => question.id))
        }

        return this.service.extractData(customer, questionIds.map(id => ({id})))
    }

    @Get('extractAllData')
    async extractAllData(
        @Query('customer') customer: string
    ) {
        const questionIds = (await this.service.listQuestions()).map(question => question.id)

        return this.service.extractData(customer, questionIds.map(id => ({id})))
            .catch(err => console.error(err))
    }
}
