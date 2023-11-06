import {Body, Controller, Get, Post, Query} from "@nestjs/common";
import {ApiProperty, ApiTags} from "@nestjs/swagger";

import {DataExtractionApi} from "../../services";

class FindPassagesInput {
    @ApiProperty()
    question: string;
    @ApiProperty()
    passages: string[] = []
}

@ApiTags('data-extraction')
@Controller('data-extraction')
export class DataExtractionController {
    constructor(private readonly service: DataExtractionApi) {
    }

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

    @Post('findRelevantPassages')
    async findRelevantPassages(
        @Body() input: FindPassagesInput
    ): Promise<string> {
        return this.service.findRelevantPassages(input.question, input.passages)
    }
}
