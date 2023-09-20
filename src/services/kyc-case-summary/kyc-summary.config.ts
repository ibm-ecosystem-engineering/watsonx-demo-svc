import {Configuration} from "./configuration";

let _instance: Configuration;
export const kycCaseSummaryConfig = (): Configuration => {
    if (_instance) {
        return _instance;
    }

    _instance = new Configuration({
        username: process.env.KYC_SUMMARY_USERNAME,
        password: process.env.KYC_SUMMARY_PASSWORD,
        basePath: process.env.KYC_SUMMARY_BASE_PATH,
    });

    // if (!_instance.username || !_instance.password) {
    //     throw new Error('KYC_SUMMARY_USERNAME or KYC_SUMMARY_PASSWORD not set');
    // }

    return _instance;
}
