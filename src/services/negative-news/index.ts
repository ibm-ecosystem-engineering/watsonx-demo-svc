import {KycCaseManagementApi} from "../kyc-case";
import {Provider} from "@nestjs/common";
import {KycCaseManagementMock} from "../kyc-case/kyc-case-management.mock";
import {NegativeNewsApi} from "./negative-news.api";
import {NegativeNewsImpl} from "./negative-news.impl";

export * from './negative-news.api';


let _instance: NegativeNewsApi;

export const negativeNewsProvider: Provider = {
    provide: NegativeNewsApi,
    useFactory: (): NegativeNewsApi => {
        if (_instance) {
            return _instance;
        }

        return _instance = new NegativeNewsImpl();
    },
};
