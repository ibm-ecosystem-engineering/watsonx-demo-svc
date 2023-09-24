import {Provider} from "@nestjs/common";

import {helloWorldProvider} from "./hello-world";
import {kycCaseProvider} from "./kyc-case";
import {dataExtractionProvider} from "./data-extraction";
import {menuOptionsProvider} from "./menu-options";
import {documentManagerProvider} from "./document-manager";
import {negativeNewsProvider} from "./negative-news";
import {kycCaseSummaryProvider} from "./kyc-case-summary";
import {webScrapeProvider} from "./web-scrape";

export * from './data-extraction';
export * from './hello-world';
export * from './kyc-case';
export * from './menu-options';
export * from './document-manager';
export * from './negative-news';
export * from './kyc-case-summary';
export * from './web-scrape';

export const providers: Provider[] = [
    helloWorldProvider,
    kycCaseProvider,
    dataExtractionProvider,
    menuOptionsProvider,
    documentManagerProvider,
    negativeNewsProvider,
    kycCaseSummaryProvider,
    webScrapeProvider,
];
