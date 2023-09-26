import {DocumentDownloadModel, DocumentUploadModel, DocumentManagerApi, DocumentOutputModel} from "./document-manager.api";
import {FileUploadContext} from "../../models";

export class DocumentManagerMock implements DocumentManagerApi {
    async downloadFile(path: string): Promise<DocumentDownloadModel> {
        return undefined;
    }

    async uploadFile(input: DocumentUploadModel): Promise<DocumentOutputModel> {
        return undefined as any;
    }

    async listFiles(input: {statuses?: string[], context?: FileUploadContext}): Promise<DocumentOutputModel[]> {
        return [];
    }
}
