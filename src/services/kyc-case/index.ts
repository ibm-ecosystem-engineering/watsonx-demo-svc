import {Provider} from "@nestjs/common";

import {KycCaseManagementMock} from "./kyc-case-management.mock";
import {KycCaseManagementApi} from "./kyc-case-management.api";
import {NegativeNewsApi, negativeNewsProvider} from "../negative-news";

export * from './kyc-case-management.api';

let _instance: KycCaseManagementApi;

export const kycCaseProvider: Provider = {
    provide: KycCaseManagementApi,
    useFactory: (negativeNews: NegativeNewsApi): KycCaseManagementApi => {
        if (_instance) {
            return _instance;
        }

        return _instance = new KycCaseManagementMock(negativeNews);
    },
};
