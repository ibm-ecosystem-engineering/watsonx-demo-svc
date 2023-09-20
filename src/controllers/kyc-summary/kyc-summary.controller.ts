import {AxiosResponse} from "axios";
import {Body, Controller, Post, UploadedFile, UseInterceptors} from "@nestjs/common";
import {ApiConsumes, ApiHeader, ApiParam, ApiProperty, ApiTags} from "@nestjs/swagger";

import {kycCaseSummaryConfig} from "../../config";
import {DefaultApiFactory, Entity, IDefaultApi} from "../../services";
import {FileInterceptor} from "@nestjs/platform-express";
import {SwaggerEnumType} from "@nestjs/swagger/dist/types/swagger-enum.type";

class EntityData implements Entity {
    @ApiProperty()
    entity: string;
}

@ApiTags('kyc-summary')
@Controller('kyc-summary')
export class KycSummaryController {

    api: IDefaultApi;

    constructor() {
        const config = kycCaseSummaryConfig();

        this.api = DefaultApiFactory(config);
    }

    @Post('summary')
    async requestSummaryPost(@Body() body: EntityData) : Promise<AxiosResponse<any>> {

        return this.api.requestSummaryPost(body);
    }

    @Post('financials')
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFinancialsPostForm(@UploadedFile() file: Express.Multer.File) : Promise<AxiosResponse<any>> {
        const blob = new Blob([file.buffer], {type: file.mimetype});

        return this.api.uploadFinancialsPostForm(blob);
    }
}
