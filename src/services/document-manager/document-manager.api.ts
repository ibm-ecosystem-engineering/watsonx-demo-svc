import {Readable} from "stream";
import {FileUploadContext} from "../../models";

export interface DocumentUploadModel {
    content: {buffer: Buffer}
    name: string;
    parentId: string;
    context?: FileUploadContext;
}

export interface DocumentOutputModel {
    name: string;
    path: string;
    id: string;
    status?: string;
}

export interface DocumentDownloadModel {
    stream: Readable;
}

export abstract class DocumentManagerApi {

    abstract listFiles(input?: {statuses?: string[], context?: FileUploadContext, ids?: string[]}): Promise<DocumentOutputModel[]>;

    abstract uploadFile(input: DocumentUploadModel): Promise<DocumentOutputModel>;

    abstract downloadFile(path: string): Promise<DocumentDownloadModel>;
}
