import * as https from "https";
import {Configuration} from "./configuration";

let _instance: Configuration;
export const customerRiskAssessmentConfig = (): Configuration => {
    if (_instance) {
        return _instance;
    }

    const username = process.env.CRA_USERNAME;
    const password = process.env.CRA_PASSWORD;
    const apiKey = process.env.CRA_API_KEY;

    const buildAuthorization = () => {
        if (username && apiKey) {
            const token = Buffer.from(`${username}:${apiKey}`).toString('base64')

            return `ZenApiKey ${token}`
        }

        const token = Buffer.from(`${username}:${password}`).toString('base64')

        return `Basic ${token}`
    }

    _instance = new Configuration({
        username,
        password,
        apiKey,
        basePath: process.env.CRA_BASE_PATH,
        baseOptions: {
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            }),
            headers: {
                'Authorization': buildAuthorization()
            }
        }
    });

    if (!(_instance.username && _instance.password) && !_instance.apiKey) {
        throw new Error('CRA_USERNAME, CRA_PASSWORD, and/or CRA_API_KEY not set');
    }

    return _instance;
}
