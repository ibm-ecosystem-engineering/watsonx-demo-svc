import Axios from 'axios';

import {KycCaseSummaryApi} from "./kyc-case-summary.api";


interface KycCaseSummaryConfig {
    url: string;
}

let _config: KycCaseSummaryConfig;
const buildKycCaseSummaryConfig = () => {
    if (_config) {
        return _config;
    }

    return _config = {
        url: process.env.KYC_SUMMARY_URL || 'https://kyc-summary-api.177i1pavvk8r.us-south.codeengine.appdomain.cloud/summarise'
    }
}

export class KycCaseSummaryImpl implements KycCaseSummaryApi {
    summarize(name: string): Promise<string> {
        const {url} = buildKycCaseSummaryConfig();

        return Axios.get(
            `${url}/${name}`,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.data);
    }
}