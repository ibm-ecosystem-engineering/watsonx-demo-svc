import {Readable} from "stream";

export interface DocumentUploadModel {
    content: {buffer: Buffer}
    name: string;
    parentId: string;
}

export interface DocumentOutputModel {
    name: string;
    path: string;
}

export interface DocumentDownloadModel {
    stream: Readable;
}

export abstract class DocumentManagerApi {

    abstract uploadFile(input: DocumentUploadModel): Promise<DocumentOutputModel>;

    abstract downloadFile(path: string): Promise<DocumentDownloadModel>;
}
