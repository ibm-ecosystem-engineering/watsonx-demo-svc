import {Configuration} from "../services/customer-risk-assessment";

let _instance: Configuration;
export const customerRiskAssessmentConfig = (): Configuration => {
    if (_instance) {
        return _instance;
    }

    _instance = new Configuration({
        username: process.env.CRA_USERNAME,
        password: process.env.CRA_PASSWORD,
        basePath: process.env.CRA_BASE_PATH,
    });

    if (!_instance.username || !_instance.password) {
        throw new Error('CRA_USERNAME or CRA_PASSWORD not set');
    }

    return _instance;
}
