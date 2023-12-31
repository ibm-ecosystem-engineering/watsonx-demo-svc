import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Res,
    StreamableFile,
    UploadedFile,
    UseInterceptors
} from "@nestjs/common";
import {FileInterceptor} from "@nestjs/platform-express";
import {getType} from "mime";

import {DocumentManagerApi, DocumentOutputModel, KycCaseManagementApi} from "../../services";
import {FileUploadContext} from "../../models";

@Controller('document')
export class FileUploadController {

    constructor(
        private readonly service: KycCaseManagementApi,
        private readonly documentManagerService: DocumentManagerApi,
    ) {}

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(@Body() input: {name: string, parentId: string, context?: FileUploadContext, standalone?: string}, @UploadedFile() file: Express.Multer.File): Promise<DocumentOutputModel> {

        if (input.context === 'data-extraction' || input.standalone === 'true') {
            return this.documentManagerService
                .uploadFile({
                    name: input.name,
                    parentId: input.parentId,
                    context: input.context,
                    content: file
                })
                .then(doc => ({
                    name: doc.name,
                    id: doc.id,
                    path: `document/${doc.path}`
                }))
        } else {
            return this.service
                .addDocumentToCase(input.parentId, input.name, {content: file.buffer}, '/document/')
                .then(doc => ({id: doc.id, name: doc.name, path: `${doc.path}`}));
        }
    }

    @Get()
    async listFiles(
        @Query('context') context: FileUploadContext = 'kyc-case',
        @Query('status') status: string[],
        @Query('ids') id: string[],
    ): Promise<DocumentOutputModel[]> {
        const statuses: string[] | undefined = !status ? undefined : (Array.isArray(status) ? status : [status]);
        const ids: string[] | undefined = !id ? undefined : (Array.isArray(id) ? id : [id]);

        return this.documentManagerService.listFiles({statuses, context, ids});
    }

    @Get(':id/:name')
    async downloadFile(
        @Param('id') id: string,
        @Param('name') name: string,
        @Res({ passthrough: true }) res: Response
    ): Promise<StreamableFile> {
        const document = await this.service.getDocument(id);

        (res as any).set({
            'Content-Type': getType(document.name),
            'Content-Disposition': `attachment; filename="${document.name}"`
        })

        return new StreamableFile(document.content, {type: getType(document.name)});
    }
}
