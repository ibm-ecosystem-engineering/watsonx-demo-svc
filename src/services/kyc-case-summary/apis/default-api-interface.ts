import {Entity} from "../models";
import {AxiosRequestConfig, AxiosResponse} from "axios";

export abstract class IDefaultApi {
    /**
     *
     * @summary Request
     * @param {Entity} body
     * @param {*} [options] Override http request option.
     * @throws {RequiredError}
     * @memberof DefaultApi
     */
    abstract requestSummaryPost(body: Entity, options?: AxiosRequestConfig) : Promise<AxiosResponse<any>>;
    /**
     *
     * @summary Upload
     * @param {Blob} file
     * @param {*} [options] Override http request option.
     * @throws {RequiredError}
     * @memberof DefaultApi
     */
    abstract uploadFinancialsPostForm(file: Blob, options?: AxiosRequestConfig) : Promise<AxiosResponse<any>>;
}
