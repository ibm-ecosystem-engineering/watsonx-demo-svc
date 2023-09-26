import {KycCaseSummaryApi} from "./kyc-case-summary.api";
import {KycCaseSummaryImpl} from "./kyc-case-summary.impl";
import {Provider} from "@nestjs/common";

export * from './kyc-case-summary.api';

let _instance: KycCaseSummaryApi;
export const kycCaseSummaryApi = (): KycCaseSummaryApi => {
    if (_instance) {
        return _instance;
    }

    return _instance = new KycCaseSummaryImpl();
}

export const kycCaseSummaryProvider: Provider = {
    provide: KycCaseSummaryApi,
    useFactory: kycCaseSummaryApi
}
