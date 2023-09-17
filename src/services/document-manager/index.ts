import {Provider} from "@nestjs/common";
import {DocumentManagerApi} from "./document-manager.api";
import {DocumentManagerMock} from "./document-manager.mock";

export * from './document-manager.api';


let _instance: DocumentManagerApi;
const documentManagerApi = (): DocumentManagerApi => {
    if (_instance) {
        return _instance;
    }

    return _instance = new DocumentManagerMock();
}

export const documentManagerProvider: Provider = {
    provide: DocumentManagerApi,
    useFactory: documentManagerApi
}
