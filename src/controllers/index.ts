import {HelloWorldController} from './hello-world';
import {CustomerRiskAssessmentController} from "./customer-risk-assessment";
import {DataExtractionController} from "./data-extraction";
import {KycSummaryController} from "./kyc-summary";
import {FileUploadController} from "./file-upload";

export const controllers = [
    HelloWorldController,
    DataExtractionController,
    CustomerRiskAssessmentController,
    KycSummaryController,
    FileUploadController
];
