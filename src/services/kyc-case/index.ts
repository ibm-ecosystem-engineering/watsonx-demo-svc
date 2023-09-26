import {Provider} from "@nestjs/common";

import {KycCaseManagementMock} from "./kyc-case-management.mock";
import {KycCaseManagementApi} from "./kyc-case-management.api";
import {NegativeNewsApi, negativeNewsProvider} from "../negative-news";
import {cloudantBackend, CloudantBackendConfig} from "./cloudant.backend";
import {KycCaseManagementCloudant} from "./kyc-case-management.cloudant";
import {documentManagerApi} from "../document-manager";

export * from './kyc-case-management.api';

const backendConfig = cloudantBackend()

let _instance: KycCaseManagementApi;
export const kycCaseProvider: Provider = {
    provide: KycCaseManagementApi,
    useFactory: (negativeNews: NegativeNewsApi): KycCaseManagementApi => {
        if (_instance) {
            return _instance;
        }

        let instance;
        if (backendConfig.apikey && backendConfig.url) {
            console.log('Loading cloudant backend')
            instance = new KycCaseManagementCloudant(documentManagerApi(), backendConfig as CloudantBackendConfig)
        } else {
            instance = new KycCaseManagementMock(negativeNews);
        }

        return _instance = instance;
    },
};
