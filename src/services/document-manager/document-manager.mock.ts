import {DocumentDownloadModel, DocumentUploadModel, DocumentManagerApi, DocumentOutputModel} from "./document-manager.api";

export class DocumentManagerMock implements DocumentManagerApi {
    async downloadFile(path: string): Promise<DocumentDownloadModel> {
        return undefined;
    }

    async uploadFile(input: DocumentUploadModel): Promise<DocumentOutputModel> {
        return undefined as any;
    }
}
