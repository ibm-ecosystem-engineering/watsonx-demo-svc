import {Controller} from "@nestjs/common";
import {ApiTags} from "@nestjs/swagger";
import {DefaultApiFactory, Entity, IDefaultApi} from "../../services/kyc-case-summary";
import {kycCaseSummaryConfig} from "../../config";
import {AxiosRequestConfig, AxiosResponse} from "axios";

@ApiTags('kyc-summary')
@Controller('kyc-summary')
export class KycSummaryController implements IDefaultApi {

    api: IDefaultApi;

    constructor() {
        const config = kycCaseSummaryConfig();

        this.api = DefaultApiFactory(config);
    }

    async requestSummaryPost(body: Entity) : Promise<AxiosResponse<any>> {
        return this.api.requestSummaryPost(body);
    }

    async uploadFinancialsPostForm(file: Blob) : Promise<AxiosResponse<any>> {
        return this.api.uploadFinancialsPostForm(file);
    }
}
