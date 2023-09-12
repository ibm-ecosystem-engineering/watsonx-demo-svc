import {Configuration} from "../services/customer-risk-assessment";

let _instance: Configuration;
export const customerRiskAssessmentConfig = (): Configuration => {
    if (_instance) {
        return _instance;
    }

    _instance = new Configuration({
        apiKey: process.env.CRA_API_KEY,
        basePath: process.env.CRA_BASE_PATH,
    });

    if (!_instance.apiKey) {
        throw new Error('CRA_API_KEY not set');
    }

    return _instance;
}
