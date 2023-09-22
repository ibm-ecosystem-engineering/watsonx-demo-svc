import {Provider} from "@nestjs/common";

import {DocumentManagerApi} from "./document-manager.api";
import {DocumentManagerDiscovery} from "./document-manager.discovery";

export * from './document-manager.api';


let _instance: DocumentManagerApi;
const documentManagerApi = (): DocumentManagerApi => {
    if (_instance) {
        return _instance;
    }

    return _instance = new DocumentManagerDiscovery();
}

export const documentManagerProvider: Provider = {
    provide: DocumentManagerApi,
    useFactory: documentManagerApi
}
