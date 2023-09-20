import {AxiosResponse} from "axios";
import {Body, Controller, Post, UploadedFile, UseInterceptors} from "@nestjs/common";
import {FileInterceptor} from "@nestjs/platform-express";
import {ApiConsumes, ApiProperty, ApiTags} from "@nestjs/swagger";

import {DefaultApiFactory, Entity, IDefaultApi, kycCaseSummaryConfig} from "../../services";

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
