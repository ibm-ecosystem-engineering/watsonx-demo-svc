import {IamAuthenticator, IamTokenManager} from "ibm-cloud-sdk-core";
import DiscoveryV2 from "ibm-watson/discovery/v2";

import {
    DocumentDownloadModel,
    DocumentManagerApi,
    DocumentOutputModel,
    DocumentUploadModel
} from "./document-manager.api";
import {buildDataExtractionBackendConfig, DataExtractionBackendConfig} from "../data-extraction/data-extraction.impl";
import {createDiscoveryV2} from "../../utils/discovery-v2";
import {getType} from "mime";
import {FileUploadContext} from "../../models";
import {first} from "../../utils";

export class DocumentManagerDiscovery implements DocumentManagerApi {
    backendConfig: DataExtractionBackendConfig;

    constructor() {
        this.backendConfig = buildDataExtractionBackendConfig();
    }

    async getBackends(): Promise<{discovery: DiscoveryV2}> {

        const accessToken = await new IamTokenManager({
            apikey: this.backendConfig.wmlApiKey,
            url: this.backendConfig.identityUrl,
        }).getToken()

        const discovery = await createDiscoveryV2({
            authenticator: new IamAuthenticator({
                apikey: this.backendConfig.discoveryApiKey,
            }),
            serviceUrl: this.backendConfig.discoveryUrl,
            version: this.backendConfig.discoveryVersion,
        })

        return {
            discovery,
        }
    }

    async downloadFile(path: string): Promise<DocumentDownloadModel> {
        const {collectionId, projectId} = this.getDiscoveryConfig()

        const {discovery} = await this.getBackends();

        const documentId = this.getDocumentIdFromPath(path);

        const result = await discovery.getDocument({
            projectId,
            collectionId,
            documentId
        })

        return Promise.resolve(undefined);
    }

    async uploadFile(input: DocumentUploadModel): Promise<DocumentOutputModel> {
        const {collectionId, projectId} = this.getDiscoveryConfig(input.context)

        const {discovery} = await this.getBackends();

        const result = await discovery
            .addDocument({
                projectId,
                collectionId,
                file: input.content.buffer,
                filename: input.name,
                fileContentType: getType(input.name),
            })
            .catch(err => {
                console.error('Error adding doc to discovery: ', err)
                throw err;
            })

        const id = result.result.document_id;

        return {
            id,
            name: input.name,
            path: buildPath(id, input.name)
        };
    }

    getDiscoveryConfig(context: FileUploadContext = 'kyc-case'): {collectionId: string, projectId: string} {
        if (context === 'data-extraction') {
            return {
                projectId: this.backendConfig.discoveryProjectId,
                collectionId: this.backendConfig.dataExtractionCollectionId,
            }
        }

        return {
            projectId: this.backendConfig.discoveryProjectId,
            collectionId: this.backendConfig.kycCollectionId
        }
    }

    getDocumentIdFromPath(path: string): string {
        return first(path.split('/')) || path;
    }

    async listFiles(input: {statuses?: string[], context?: FileUploadContext} = {}): Promise<DocumentOutputModel[]> {
        const {collectionId, projectId} = this.getDiscoveryConfig(input.context);

        const {discovery} = await this.getBackends();

        const status = extractStatuses(input.statuses)

        console.log('Listing files: ', {context: input.context, status, collectionId, projectId})
        return discovery
            .listDocuments({
                projectId,
                collectionId,
                status: status.join(',')
            })
            .then(response => response.result.documents
                .map((doc: DiscoveryV2.DocumentDetails) => ({
                    id: doc.document_id,
                    name: doc.filename,
                    path: buildPath(doc.document_id, doc.filename),
                    status: doc.status || (status.length === 1 ? status[0] : undefined)
                }))
            )
    }
}

const statusValues = ['failed', 'pending', 'processing', 'available'];

const extractStatuses = (statuses: string[] = []): string[] => {
    console.log('Filtering statuses: ', {statuses})
    const status = statuses.filter(val => statusValues.includes(val));
    console.log('Filtered status: ', {status})

    if (status.length === 0) {
        return ['failed', 'pending', 'processing'];
    }

    return status;
}

const buildPath = (id: string, name?: string): string | undefined => {
    if (!name) {
        return
    }

    return `${id}/${name}`;
}
