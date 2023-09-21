import {MenuOptionsMock} from "./menu-options.mock";
import {Provider} from "@nestjs/common";
import {MenuOptionsApi} from "./menu-options.api";

export * from './menu-options.api';

let _instance: MenuOptionsApi;
const menuOptionsApi = (): MenuOptionsApi => {
    if (_instance) {
        return _instance;
    }

    return _instance = new MenuOptionsMock();
}

export const menuOptionsProvider: Provider = {
    provide: MenuOptionsApi,
    useFactory: menuOptionsApi
}
